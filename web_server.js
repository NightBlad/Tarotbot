// Simple Web Server for Tarot Web App
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

// Use global fetch (Node.js 18+) or import node-fetch if needed
const fetch = globalThis.fetch || require('node-fetch');

const app = express();
const PORT = process.env.PORT || process.env.WEB_PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Config endpoint - provides frontend with necessary URLs
app.get('/api/config', (req, res) => {
    res.json({
        tarotApiUrl: process.env.TAROT_API_URL || 'https://tarotbot-astc.onrender.com',
        langflowUrl: process.env.LANGFLOW_API_URL || null,
        langflowKey: process.env.LANGFLOW_API_KEY || null
    });
});

// Proxy endpoint for LangFlow (to avoid CORS issues)
app.post('/api/langflow/:flow', async (req, res) => {
    try {
        const { flow } = req.params;
        const langflowUrl = process.env.LANGFLOW_API_URL;
        
        console.log('=== LangFlow Request ===');
        console.log('Flow:', flow);
        console.log('Body:', JSON.stringify(req.body, null, 2));
        
        if (!langflowUrl) {
            return res.status(500).json({ error: 'LangFlow URL not configured' });
        }

        // Build full URL
        let url = langflowUrl.replace('{flow}', encodeURIComponent(flow));
        console.log('URL:', url);
        
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

        // Forward request to LangFlow
        const fetch = require('node-fetch');
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(req.body)
        });

        console.log('LangFlow Response Status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('LangFlow Error Response:', errorText);
            throw new Error(`LangFlow error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('=== LangFlow Response ===');
        console.log(JSON.stringify(data, null, 2));
        
        res.json(data);
    } catch (error) {
        console.error('LangFlow proxy error:', error);
        res.status(500).json({ error: error.message });
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
    ║                                                      ║
    ║        Server running on port ${PORT}                  ║
    ║        Access at: http://localhost:${PORT}             ║
    ║                                                      ║
    ╚══════════════════════════════════════════════════════╝
    `);
    console.log('\n🔮 Configuration:');
    console.log('   - Tarot API:', process.env.TAROT_API_URL || 'http://localhost:3000');
    console.log('   - LangFlow:', process.env.LANGFLOW_API_URL ? 'Configured ✓' : 'Not configured ✗');
    console.log('\n💡 Press Ctrl+C to stop the server\n');
});

module.exports = app;
