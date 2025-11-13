// Simple Web Server for Tarot Web App
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const { LRUCache } = require('lru-cache');
const { default: PQueue } = require('p-queue');
const http = require('http');

// Use global fetch (Node.js 18+) or import node-fetch if needed
const fetch = globalThis.fetch || require('node-fetch');

const app = express();
const PORT = process.env.PORT || process.env.WEB_PORT || 8080;

// ==================== PROXY CONFIGURATION ====================
// IMPORTANT: Enable trust proxy for Render.com, Heroku, etc.
// This allows express-rate-limit to correctly identify users behind reverse proxies
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1); // Trust first proxy (Render, Heroku, etc.)
} else {
    // In development, trust proxies if X-Forwarded-For header is expected
    app.set('trust proxy', true);
}

// ==================== MULTI-USER OPTIMIZATION ====================

// 1. Session Management - Track individual user sessions
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'tarot-mystic-secret-key-change-in-production',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    name: 'tarot.sid'
});

// 2. Request Queue - Prevent overwhelming LangFlow API
const langflowQueue = new PQueue({ 
    concurrency: parseInt(process.env.LANGFLOW_CONCURRENCY || '3'), // Max 3 simultaneous LangFlow calls
    timeout: 60000, // 60 second timeout per request
    throwOnTimeout: true
});

// 3. Response Cache - Cache identical readings to reduce API calls
const readingCache = new LRUCache({
    max: parseInt(process.env.CACHE_MAX_ITEMS || '500'), // Store up to 500 readings
    ttl: parseInt(process.env.CACHE_TTL || '3600000'), // 1 hour TTL
    updateAgeOnGet: true
});

// 4. Rate Limiting - Prevent abuse and ensure fair usage
const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'), // 1 minute
    max: parseInt(process.env.RATE_LIMIT_MAX || '30'), // 30 requests per minute
    message: {
        error: 'Quá nhiều yêu cầu từ IP này. Vui lòng thử lại sau.',
        retryAfter: 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Quá nhiều yêu cầu từ IP này. Vui lòng thử lại sau.',
            retryAfter: 60,
            queueLength: langflowQueue.size
        });
    }
});

const langflowLimiter = rateLimit({
    windowMs: parseInt(process.env.LANGFLOW_RATE_WINDOW || '60000'), // 1 minute
    max: parseInt(process.env.LANGFLOW_RATE_MAX || '10'), // 10 LangFlow calls per minute per IP
    message: {
        error: 'Quá nhiều yêu cầu bói bài. Vui lòng đợi một chút.',
        retryAfter: 60
    },
    skipSuccessfulRequests: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Quá nhiều yêu cầu bói bài. Vui lòng đợi một chút.',
            retryAfter: 60,
            queueLength: langflowQueue.size
        });
    }
});

// 5. Connection Pooling - Reuse HTTP connections
const httpAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 60000
});

// 6. Performance Monitoring
let stats = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    queuedRequests: 0,
    activeUsers: new Set(),
    startTime: Date.now()
};

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
app.use(express.json());
app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, 'public')));

// Track active users
app.use((req, res, next) => {
    if (req.session) {
        stats.activeUsers.add(req.session.id);
        req.session.lastActivity = Date.now();
    }
    next();
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// ==================== API ENDPOINTS ====================

// Server status and metrics endpoint
app.get('/api/status', (req, res) => {
    const uptime = Date.now() - stats.startTime;
    const cacheHitRate = stats.totalRequests > 0 
        ? ((stats.cacheHits / stats.totalRequests) * 100).toFixed(2)
        : 0;
    
    res.json({
        status: 'healthy',
        uptime: Math.floor(uptime / 1000), // seconds
        stats: {
            totalRequests: stats.totalRequests,
            cacheHits: stats.cacheHits,
            cacheMisses: stats.cacheMisses,
            cacheHitRate: `${cacheHitRate}%`,
            activeUsers: stats.activeUsers.size,
            queueLength: langflowQueue.size,
            queuePending: langflowQueue.pending,
            cacheSize: readingCache.size
        }
    });
});

// API Config endpoint - provides frontend with necessary URLs
app.get('/api/config', (req, res) => {
    res.json({
        tarotApiUrl: process.env.TAROT_API_URL || 'https://tarotbot-astc.onrender.com',
        langflowUrl: process.env.LANGFLOW_API_URL || null,
        langflowKey: process.env.LANGFLOW_API_KEY || null
    });
});

// Proxy endpoint for LangFlow (to avoid CORS issues)
app.post('/api/langflow/:flow', langflowLimiter, async (req, res) => {
    const requestId = `${req.session.id}-${Date.now()}`;
    const startTime = Date.now();
    
    try {
        const { flow } = req.params;
        const langflowUrl = process.env.LANGFLOW_API_URL;
        
        stats.totalRequests++;
        
        // Generate cache key from request
        const cacheKey = JSON.stringify({
            flow,
            body: req.body
        });
        
        // Check cache first
        const cachedResponse = readingCache.get(cacheKey);
        if (cachedResponse) {
            stats.cacheHits++;
            console.log(`[${requestId}] Cache HIT - Returning cached reading (${stats.cacheHits}/${stats.totalRequests})`);
            return res.json(cachedResponse);
        }
        
        stats.cacheMisses++;
        console.log(`[${requestId}] Cache MISS - Queuing new request (Queue: ${langflowQueue.size} waiting, ${langflowQueue.pending} active)`);
        
        if (!langflowUrl) {
            return res.status(500).json({ error: 'LangFlow URL not configured' });
        }

        // Add to queue to prevent overwhelming the API
        stats.queuedRequests++;
        const queuePosition = langflowQueue.size;
        
        // Notify client of queue status
        if (queuePosition > 0) {
            console.log(`[${requestId}] Waiting in queue. Position: ${queuePosition + 1}`);
        }
        
        const data = await langflowQueue.add(async () => {
            console.log(`[${requestId}] Processing LangFlow request (Flow: ${flow})`);
            
            // Build full URL
            let url = langflowUrl.replace('{flow}', encodeURIComponent(flow));
            
            const headers = {
                'Content-Type': 'application/json'
            };

            // Add auth header if key is present
            const langflowKey = process.env.LANGFLOW_API_KEY;
            if (langflowKey) {
                const headerName = process.env.LANGFLOW_AUTH_HEADER || 'Authorization';
                if (headerName.toLowerCase() === 'authorization') {
                    headers[headerName] = langflowKey.startsWith('Bearer ') ? langflowKey : `Bearer ${langflowKey}`;
                } else {
                    headers[headerName] = langflowKey;
                }
            }

            // Forward request to LangFlow with connection pooling
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(req.body),
                agent: httpAgent,
                timeout: 50000
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[${requestId}] LangFlow Error Response:`, errorText);
                throw new Error(`LangFlow error: ${response.status} ${response.statusText}`);
            }

            const responseData = await response.json();
            
            const duration = Date.now() - startTime;
            console.log(`[${requestId}] LangFlow request completed in ${duration}ms`);
            
            return responseData;
        });
        
        // Cache the successful response
        readingCache.set(cacheKey, data);
        console.log(`[${requestId}] Response cached (Cache size: ${readingCache.size}/${readingCache.max})`);
        
        res.json(data);
    } catch (error) {
        console.error(`[${requestId}] LangFlow proxy error:`, error.message);
        
        if (error.name === 'TimeoutError') {
            return res.status(504).json({ 
                error: 'Yêu cầu xử lý quá lâu. Vui lòng thử lại.',
                retryAfter: 30
            });
        }
        
        res.status(500).json({ 
            error: error.message,
            queueLength: langflowQueue.size
        });
    }
});

// Proxy endpoint for Tarot API /cards (to avoid CORS issues)
app.get('/api/cards', async (req, res) => {
    try {
        const tarotApiUrl = process.env.TAROT_API_URL || 'https://tarotbot-astc.onrender.com';
        const url = `${tarotApiUrl}/cards`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Tarot API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Tarot API proxy error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Proxy endpoint for Tarot API /draw/:type (to avoid CORS issues)
app.get('/api/draw/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const tarotApiUrl = process.env.TAROT_API_URL || 'https://tarotbot-astc.onrender.com';
        const queryString = new URLSearchParams(req.query).toString();
        const url = `${tarotApiUrl}/draw/${type}${queryString ? '?' + queryString : ''}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Tarot API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Tarot API proxy error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════════════════════╗
    ║                                                      ║
    ║        ✨ Tarot Mystic Web App ✨                  ║
    ║        🚀 Multi-User Optimized Edition              ║
    ║                                                      ║
    ║        Server running on port ${PORT}                  ║
    ║        Access at: http://localhost:${PORT}             ║
    ║                                                      ║
    ╚══════════════════════════════════════════════════════╝
    `);
    console.log('\n🔮 Configuration:');
    console.log('   - Tarot API:', process.env.TAROT_API_URL || 'https://tarotbot-astc.onrender.com');
    console.log('   - LangFlow:', process.env.LANGFLOW_API_URL ? 'Configured ✓' : 'Not configured ✗');
    console.log('\n⚡ Performance Features:');
    console.log('   - Session Management: ✓');
    console.log('   - Request Rate Limiting:', `${process.env.RATE_LIMIT_MAX || 30} req/min`);
    console.log('   - LangFlow Queue:', `${process.env.LANGFLOW_CONCURRENCY || 3} concurrent`);
    console.log('   - Response Cache:', `${process.env.CACHE_MAX_ITEMS || 500} items, ${(parseInt(process.env.CACHE_TTL || '3600000') / 60000).toFixed(0)}min TTL`);
    console.log('   - Connection Pooling: ✓');
    console.log('\n� Monitor at: http://localhost:' + PORT + '/api/status');
    console.log('\n�💡 Press Ctrl+C to stop the server\n');
    
    // Log stats every 5 minutes
    setInterval(() => {
        const uptime = Math.floor((Date.now() - stats.startTime) / 1000 / 60);
        const cacheHitRate = stats.totalRequests > 0 
            ? ((stats.cacheHits / stats.totalRequests) * 100).toFixed(2)
            : 0;
        
        console.log(`\n📊 Stats (Uptime: ${uptime}min):`);
        console.log(`   - Total Requests: ${stats.totalRequests}`);
        console.log(`   - Cache Hit Rate: ${cacheHitRate}%`);
        console.log(`   - Active Users: ${stats.activeUsers.size}`);
        console.log(`   - Queue: ${langflowQueue.size} waiting, ${langflowQueue.pending} active`);
        console.log(`   - Cache Size: ${readingCache.size}/${readingCache.max}\n`);
    }, 5 * 60 * 1000);
});

module.exports = app;
