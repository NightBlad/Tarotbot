# Tarot Mystic Web App 🔮

Trang web bói bài Tarot đẹp mắt với hiệu ứng hình ảnh và tích hợp LangFlow AI.

## Tính năng

✨ **Giao diện đẹp mắt**
- Background động với hiệu ứng sao và particles tương tác
- Thiết kế theo chủ đề chiêm tinh học (màu tím huyền bí, vàng kim)
- Animation mượt mà khi chuyển trang và hiển thị kết quả

🎴 **12 loại trải bài**
- Một lá bài
- Ba lá bài
- Năm lá bài
- Celtic Cross
- Quá khứ/Hiện tại/Tương lai
- Tâm/Thân/Thần
- Mối quan hệ (hiện tại & tiềm năng)
- Ra quyết định
- Luật hấp dẫn
- Buông bỏ & giữ lại
- Lợi thế & trở ngại

🔮 **Tích hợp LangFlow**
- Gọi API LangFlow để giải nghĩa bài
- Tự động parse và hiển thị kết quả
- Hỗ trợ nhiều định dạng response

🎨 **Hiển thị lá bài**
- Hiển thị trực tiếp các lá bài theo layout của từng spread
- Hỗ trợ hình ảnh lá bài (xuôi/ngược)
- Animation reveal đẹp mắt

## Cài đặt

1. **Cài đặt dependencies** (nếu chưa có):
```bash
npm install express cors
```

2. **Cấu hình .env**:
```env
# Web server port
WEB_PORT=8080

# Tarot API URL
TAROT_API_URL=http://localhost:3000

# LangFlow configuration
LANGFLOW_API_URL=https://your-langflow-url/api/v1/run/{flow}
LANGFLOW_API_KEY=your-api-key-here
LANGFLOW_AUTH_HEADER=Authorization
```

3. **Chạy web server**:
```bash
node web_server.js
```

4. **Truy cập**:
Mở trình duyệt tại: http://localhost:8080

## Cấu trúc thư mục

```
Tarotbot/
├── public/
│   ├── index.html      # Trang chủ
│   ├── styles.css      # Styling
│   ├── app.js          # Logic chính
│   └── particles.js    # Particle animation
├── web_server.js       # Express server
└── .env                # Configuration
```

## Sử dụng

1. **Chọn loại trải bài** từ trang chủ
2. **Nhập câu hỏi** (tùy chọn)
3. **Chọn Significator** (chỉ với Luật Hấp Dẫn)
4. **Nhấn "Bắt Đầu Bói"**
5. Xem kết quả với **hình ảnh lá bài** và **lời giải nghĩa**

## Tùy chỉnh

### Thay đổi màu sắc
Chỉnh sửa CSS variables trong `public/styles.css`:
```css
:root {
    --primary-color: #7B68EE;
    --secondary-color: #9370DB;
    --accent-color: #FFD700;
}
```

### Thay đổi số lượng particles
Chỉnh sửa trong `public/particles.js`:
```javascript
this.particleCount = 50; // Tăng/giảm số lượng
```

### Tùy chỉnh layout lá bài
Chỉnh sửa grid trong `public/styles.css`:
```css
.cards-display {
    display: flex;
    gap: 2rem;
    /* Thay đổi layout tại đây */
}
```

## API Endpoints

### GET /api/config
Trả về cấu hình cho frontend:
```json
{
    "tarotApiUrl": "http://localhost:3000",
    "langflowUrl": "https://...",
    "langflowKey": "..."
}
```

### POST /api/langflow/:flow
Proxy để gọi LangFlow API (tránh CORS):
- Body: LangFlow payload
- Response: LangFlow response

## Responsive Design

Trang web hoàn toàn responsive:
- ✅ Desktop (1400px+)
- ✅ Tablet (768px - 1400px)
- ✅ Mobile (< 768px)

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers

## Troubleshooting

### Lá bài không hiển thị hình ảnh
- Kiểm tra đường dẫn hình ảnh trong `getCardImageUrl()`
- Đảm bảo Tarot API có endpoint `/images/{card}.jpg`

### LangFlow không hoạt động
- Kiểm tra `LANGFLOW_API_URL` trong `.env`
- Kiểm tra API key và auth header
- Xem console log trong browser (F12)

### Particles lag
- Giảm `particleCount` trong `particles.js`
- Tắt particle system nếu cần

## License

MIT License - Sử dụng tự do cho dự án cá nhân và thương mại.

---

Made with ✨ and 🔮 by Tarot Mystic Team
