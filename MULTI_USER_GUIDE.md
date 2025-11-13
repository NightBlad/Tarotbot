# 🚀 Multi-User Optimization Guide

## Tổng Quan

Hệ thống đã được tối ưu hóa để phục vụ nhiều người dùng đồng thời một cách mượt mà và hiệu quả. Các tính năng chính bao gồm:

✅ **Session Management** - Quản lý phiên người dùng  
✅ **Request Rate Limiting** - Giới hạn request để tránh abuse  
✅ **Request Queuing** - Xếp hàng request để tránh quá tải API  
✅ **Response Caching** - Cache kết quả để tăng tốc độ  
✅ **Connection Pooling** - Tái sử dụng kết nối HTTP  
✅ **Performance Monitoring** - Giám sát hiệu suất real-time  

---

## Kiến Trúc

```
┌─────────────┐
│   User 1    │──┐
└─────────────┘  │
┌─────────────┐  │    ┌──────────────────┐
│   User 2    │──┼───▶│  Web Server      │
└─────────────┘  │    │  - Sessions      │
┌─────────────┐  │    │  - Rate Limiter  │
│   User N    │──┘    │  - Cache (LRU)   │
└─────────────┘       └──────────────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │  Request Queue   │
                      │  (max 3 async)   │
                      └──────────────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │  LangFlow API    │
                      │  (AI Service)    │
                      └──────────────────┘
```

---

## Các Tính Năng Chi Tiết

### 1. Session Management

**Mục đích:** Theo dõi từng người dùng riêng biệt, duy trì state giữa các requests.

**Hoạt động:**
- Mỗi user được tạo session ID unique khi truy cập lần đầu
- Session được lưu trong memory (hoặc Redis cho production)
- Cookie được gửi cho browser để maintain session
- Session timeout: 24 giờ

**Lợi ích:**
- Tracking active users
- Personalized experience
- Session-based rate limiting (có thể mở rộng)

---

### 2. Request Rate Limiting

**Mục đích:** Ngăn chặn abuse, đảm bảo tài nguyên được phân phối công bằng.

**Cấu hình:**

```env
# Tổng request limit (cho tất cả API endpoints)
RATE_LIMIT_WINDOW=60000    # 1 phút
RATE_LIMIT_MAX=30          # 30 requests/phút/IP

# LangFlow specific limit (cho endpoint bói bài)
LANGFLOW_RATE_WINDOW=60000 # 1 phút  
LANGFLOW_RATE_MAX=10       # 10 lần bói/phút/IP
```

**Hành vi:**
- Tracking theo IP address
- Reset sau mỗi window
- HTTP 429 (Too Many Requests) nếu vượt quá
- Header `Retry-After` cho client biết khi nào retry

**Tùy chỉnh:**
- Site nhỏ: giữ nguyên default
- Site vừa: tăng lên 50 requests/phút
- Site lớn: 100+ requests/phút, cân nhắc per-user limiting

---

### 3. Request Queuing (p-queue)

**Mục đích:** Serialize calls tới LangFlow API, tránh overwhelm service.

**Cấu hình:**

```env
LANGFLOW_CONCURRENCY=3  # Max 3 LangFlow calls đồng thời
```

**Hoạt động:**
```
User A → Request → Queue [1: Processing] [2: Processing] [3: Processing]
User B → Request → Queue [4: Waiting...] 
User C → Request → Queue [5: Waiting...]
                           ↓
                   Khi slot 1 hoàn thành
                           ↓
                   Request 4 được xử lý
```

**Lợi ích:**
- LangFlow API không bị quá tải
- Predictable response time
- Tự động timeout sau 60s

**Tùy chỉnh:**
- LangFlow API nhanh & stable: tăng lên 5-10
- LangFlow API chậm hoặc limited quota: giữ 2-3
- High traffic: monitor queue length, adjust accordingly

---

### 4. Response Caching (LRU Cache)

**Mục đích:** Lưu kết quả bói bài để tránh gọi API lại cho cùng question.

**Cấu hình:**

```env
CACHE_MAX_ITEMS=500      # Lưu tối đa 500 readings
CACHE_TTL=3600000        # 1 giờ (milliseconds)
```

**Cache Key:** Được tạo từ:
- Spread type (one, three, five, etc.)
- Request body (question, significator)

**Hoạt động:**
```
Request → Check cache
           │
           ├─ HIT: Return cached result (instant)
           │
           └─ MISS: Call API → Cache result → Return
```

**Metrics quan trọng:**
- **Cache Hit Rate:** % requests được serve từ cache
- Mục tiêu: 30-50% cho optimal performance
- Nếu < 20%: cân nhắc tăng TTL
- Nếu > 70%: có thể giảm cache size để tiết kiệm RAM

**Lưu ý:**
- Mỗi cached item ~1-5KB
- 500 items ≈ 2.5MB RAM
- Tự động xóa items cũ nhất khi đầy (LRU)

---

### 5. Connection Pooling

**Mục đích:** Tái sử dụng HTTP connections, giảm latency.

**Cấu hình tự động:**
```javascript
const httpAgent = new http.Agent({
    keepAlive: true,          // Giữ connection sống
    keepAliveMsecs: 30000,    // 30 giây
    maxSockets: 50,           // Max 50 sockets
    maxFreeSockets: 10,       // Giữ 10 free sockets
    timeout: 60000            // 60s timeout
});
```

**Lợi ích:**
- Giảm SSL/TLS handshake overhead
- Faster response time (~50-200ms faster)
- Reduce server load

---

### 6. Performance Monitoring

**Endpoint:** `/api/status`

**Thông tin cung cấp:**

```json
{
  "status": "healthy",
  "uptime": 3600,
  "stats": {
    "totalRequests": 1250,
    "cacheHits": 450,
    "cacheMisses": 800,
    "cacheHitRate": "36.00%",
    "activeUsers": 23,
    "queueLength": 2,
    "queuePending": 3,
    "cacheSize": 450
  }
}
```

**Console logging:**
- Mỗi 5 phút: log stats summary
- Mỗi request: log queue position, cache status
- Mỗi completion: log duration

---

## Monitoring & Tuning

### Metrics Quan Trọng

1. **Cache Hit Rate**
   - Ideal: 30-50%
   - Nếu thấp: tăng `CACHE_TTL` hoặc `CACHE_MAX_ITEMS`
   - Nếu cao: users thích same questions, giảm cache để save RAM

2. **Queue Length**
   - Ideal: 0-3 waiting
   - Consistently > 5: tăng `LANGFLOW_CONCURRENCY`
   - Consistently 0: có thể giảm concurrency để save LangFlow quota

3. **Active Users**
   - Track growth
   - Plan scaling accordingly

4. **Request Duration**
   - Cache HIT: <50ms
   - Cache MISS + Queue empty: 2-10s (depending on LangFlow)
   - Cache MISS + Queue busy: 5-30s

### Commands Hữu Ích

```bash
# Monitor real-time stats
curl http://localhost:8080/api/status

# Watch logs
npm start

# Production monitoring (với PM2)
pm2 monit
```

---

## Scaling Strategies

### Nhỏ (< 100 users/day)
✅ Default settings  
✅ In-memory cache & sessions  
✅ Single server instance  

### Vừa (100-1000 users/day)

```env
LANGFLOW_CONCURRENCY=5
CACHE_MAX_ITEMS=1000
CACHE_TTL=7200000  # 2 giờ
RATE_LIMIT_MAX=50
```

### Lớn (> 1000 users/day)

```env
LANGFLOW_CONCURRENCY=10
CACHE_MAX_ITEMS=2000
RATE_LIMIT_MAX=100
```

**Cân nhắc:**
- Redis cho session storage (thay memory)
- Redis cho distributed cache
- Load balancer + multiple instances
- CDN cho static assets
- Dedicated LangFlow instance

---

## Error Handling

### HTTP 429 - Too Many Requests

**Nguyên nhân:** User vượt quá rate limit

**Response:**
```json
{
  "error": "Quá nhiều yêu cầu từ IP này. Vui lòng thử lại sau.",
  "retryAfter": 60,
  "queueLength": 5
}
```

**Frontend xử lý:**
- Hiển thị thông báo thân thiện
- Suggest retry sau 1 phút
- Disable button tạm thời

### HTTP 504 - Gateway Timeout

**Nguyên nhân:** LangFlow API quá chậm (> 60s)

**Response:**
```json
{
  "error": "Yêu cầu xử lý quá lâu. Vui lòng thử lại.",
  "retryAfter": 30
}
```

**Hành động:**
- User retry
- Admin: check LangFlow health
- Cân nhắc tăng timeout nếu LangFlow thường chậm

---

## Best Practices

### DO ✅

1. **Monitor `/api/status` regularly**
   - Setup alerts nếu queue > 10
   - Track cache hit rate trends
   
2. **Tune based on actual usage**
   - Start với defaults
   - Adjust sau 1 tuần observation
   
3. **Log important events**
   - Rate limit violations
   - Queue timeouts
   - Cache evictions
   
4. **Test under load**
   - Simulate 10-20 concurrent users
   - Check queue behavior
   
5. **Keep cache warm**
   - Common questions sẽ tự động cached
   - Consider pre-warming popular spreads

### DON'T ❌

1. **Không set CONCURRENCY quá cao**
   - Có thể overwhelm LangFlow
   - Ban nguy cơ từ LangFlow provider
   
2. **Không set RATE_LIMIT quá thấp**
   - Ảnh hưởng UX
   - Users genuine bị block
   
3. **Không cache quá lâu**
   - Stale readings
   - Users expect fresh results
   
4. **Không ignore logs**
   - Patterns reveal problems
   - Early warnings prevent outages

---

## Troubleshooting

### Problem: Users báo "quá nhiều request"

**Giải pháp:**
1. Check `/api/status` - có abuse không?
2. Kiểm tra `RATE_LIMIT_MAX` có phù hợp không
3. Xem logs - IP nào gây ra?
4. Cân nhắc tăng limit hoặc ban IP

### Problem: Queue luôn dài

**Giải pháp:**
1. Tăng `LANGFLOW_CONCURRENCY`
2. Check LangFlow API health
3. Optimize LangFlow prompt (nếu quá dài)
4. Cân nhắc upgrade LangFlow plan

### Problem: Cache hit rate thấp

**Giải pháp:**
1. Tăng `CACHE_TTL`
2. Tăng `CACHE_MAX_ITEMS`
3. Analyze logs - users có hỏi questions khác nhau không?
4. Nếu yes: cache không help nhiều, invest vào faster API

### Problem: High memory usage

**Giải pháp:**
1. Giảm `CACHE_MAX_ITEMS`
2. Giảm `CACHE_TTL`
3. Migrate sang Redis cache
4. Scale horizontal thay vì vertical

---

## Production Checklist

- [ ] Change `SESSION_SECRET` trong .env
- [ ] Set `NODE_ENV=production`
- [ ] Configure `CORS_ORIGIN` to your domain
- [ ] Enable HTTPS (session cookies need `secure: true`)
- [ ] Setup process manager (PM2, systemd)
- [ ] Configure monitoring (logs, metrics)
- [ ] Setup Redis for sessions (optional but recommended)
- [ ] Setup Redis for cache (optional for large sites)
- [ ] Configure reverse proxy (nginx, Apache)
- [ ] Setup rate limiting at nginx level (additional layer)
- [ ] Configure log rotation
- [ ] Setup error tracking (Sentry, etc.)
- [ ] Load testing với realistic traffic

---

## Kết Luận

Hệ thống multi-user optimization này cung cấp:

✨ **Smooth UX** - Users không chờ lâu  
⚡ **High Performance** - Cache giảm load  
🛡️ **Protection** - Rate limiting chống abuse  
📊 **Visibility** - Monitoring cho admin  
🎯 **Scalability** - Dễ scale khi traffic tăng  

**Next Steps:**
1. Deploy với default settings
2. Monitor 1 tuần
3. Tune based on actual metrics
4. Enjoy smooth multi-user experience! 🎉
