# 🌟 Tính Năng Mới - Tarot Mystic Web App

## ✨ Tổng Quan

Trang web Tarot Mystic đã được nâng cấp với 5 tính năng mới cực kỳ hấp dẫn:

1. 🎵 **Nhạc nền huyền bí**
2. 🌙 **Dark/Light mode toggle**
3. 💾 **Lưu lịch sử bói**
4. 📤 **Chia sẻ kết quả**
5. 🎲 **Animation xào bài**

---

## 🎵 Nhạc Nền Huyền Bí

### Mô tả
- Nhạc meditation thư giãn chạy nền
- Tự động loop liên tục
- Âm lượng vừa phải, không làm phiền

### Cách sử dụng
1. Click nút **🎵** ở góc trên phải
2. Nhạc bắt đầu phát
3. Click lại để tắt

### Tùy chỉnh
Thay đổi nhạc nền trong `index.html`:
```html
<audio id="bgMusic" loop>
    <source src="your-music-url.mp3" type="audio/mpeg">
</audio>
```

**Gợi ý nhạc nền:**
- Meditation music
- Ambient sound
- Crystal bowl sounds
- Nature sounds

---

## 🌙 Dark/Light Mode Toggle

### Mô tả
- Chuyển đổi giữa theme tối và sáng
- Tự động lưu preference
- Smooth transition

### Theme Dark (Mặc định)
- Background: Xanh đen đậm (#0a0e27)
- Text: Trắng sáng
- Hiệu ứng sao: Đầy đủ
- Particles: Rõ nét

### Theme Light
- Background: Xám nhạt (#f0f4f8)
- Text: Xanh đen
- Hiệu ứng sao: Mờ 30%
- Particles: Mờ 50%

### Cách sử dụng
1. Click nút **🌙** (dark) hoặc **☀️** (light)
2. Theme tự động chuyển đổi
3. Preference được lưu vào localStorage

### Tùy chỉnh màu sắc
Chỉnh sửa trong `styles.css`:
```css
body.light-theme {
    --dark-bg: #your-color;
    --text-primary: #your-color;
    /* ... */
}
```

---

## 💾 Lưu Lịch Sử Bói

### Mô tả
- Tự động lưu tất cả lần bói
- Lưu trữ tối đa 50 lần gần nhất
- Hiển thị thời gian relative (vừa xong, 5 phút trước, ...)
- Lưu vào localStorage (không cần server)

### Thông tin được lưu
- ✅ Loại trải bài
- ✅ Câu hỏi
- ✅ Kết quả đầy đủ
- ✅ Thời gian bói
- ✅ Preview ngắn

### Cách sử dụng

#### Lưu thủ công
1. Sau khi bói xong
2. Click nút **💾 Lưu vào lịch sử**
3. Kết quả được lưu vào đầu danh sách

#### Xem lịch sử
1. Click nút **📜** ở góc trên phải
2. Sidebar trượt ra từ bên phải
3. Xem danh sách các lần bói

#### Xem lại kết quả cũ
1. Click vào bất kỳ item nào trong lịch sử
2. Kết quả hiện ra trang Reading
3. Có thể chia sẻ hoặc lưu lại

#### Xóa lịch sử
1. Mở sidebar lịch sử
2. Click nút **🗑️ Xóa tất cả** ở cuối
3. Confirm để xóa

### Cấu trúc dữ liệu
```javascript
{
    spread: "three",
    spreadTitle: "🔮 Ba Lá Bài",
    question: "Tình yêu của tôi?",
    date: 1699123456789,
    reading: { /* full reading data */ },
    preview: "Đoạn văn ngắn..."
}
```

---

## 📤 Chia Sẻ Kết Quả

### Mô tả
- Chia sẻ kết quả bói lên 6 nền tảng
- Tự động format nội dung
- Copy link nhanh

### Các nền tảng hỗ trợ

#### 1. 📋 Sao chép
- Copy toàn bộ text vào clipboard
- Dán được mọi nơi

#### 2. 📘 Facebook
- Mở Facebook share dialog
- Kèm title + description
- Link về trang web

#### 3. 🐦 Twitter
- Mở Twitter share
- Text ngắn gọn (200 ký tự)
- Link kèm theo

#### 4. 💬 WhatsApp
- Mở WhatsApp Web/App
- Text + link
- Gửi cho bạn bè

#### 5. ✈️ Telegram
- Mở Telegram share
- Format đẹp
- Link preview

#### 6. 📧 Email
- Mở email client
- Subject: Tên trải bài
- Body: Đầy đủ nội dung

### Cách sử dụng
1. Sau khi bói xong
2. Click nút **📤 Chia sẻ kết quả**
3. Modal hiện ra với 6 options
4. Click vào nền tảng muốn chia sẻ
5. Cửa sổ mới mở ra (hoặc copy vào clipboard)

### Tùy chỉnh nội dung chia sẻ
Chỉnh sửa trong `app.js`, method `shareReading()`:
```javascript
const text = `
    ${title}
    ${question ? 'Câu hỏi: ' + question : ''}
    ${this.currentReading.text.substring(0, 200)}...
`;
```

---

## 🎲 Animation Xào Bài

### Mô tả
- Animation 5 lá bài xào trước khi hiển thị kết quả
- 5 animation patterns khác nhau
- Thời gian: 3 giây
- Smooth transitions

### 5 Animation Patterns

#### Pattern 1: Horizontal Shuffle
- Lá bài di chuyển ngang
- Trái → Phải → Trái
- Rotate nhẹ

#### Pattern 2: Vertical Bounce
- Lá bài nhảy lên xuống
- Trên → Dưới → Trên
- Rotate đối xứng

#### Pattern 3: Scale & Rotate
- Lá bài phóng to/thu nhỏ
- Xoay nhẹ 5 độ
- Pulsing effect

#### Pattern 4: Diagonal Movement
- Lá bài di chuyển chéo
- 4 góc màn hình
- Smooth transitions

#### Pattern 5: Full Rotation
- Lá bài xoay 360°
- Continuous spin
- Center position

### Thứ tự hiển thị
1. User click "Bắt Đầu Bói"
2. ⏳ Shuffle Animation (3s)
3. ⏳ Loading State (API call)
4. ✅ Results Display

### Tùy chỉnh

#### Thay đổi thời gian xào bài
Trong `app.js`:
```javascript
// Thay đổi 3000 (3 giây) thành giá trị khác
await new Promise(resolve => setTimeout(resolve, 3000));
```

#### Thay đổi số lượng lá bài
Trong `index.html`:
```html
<!-- Thêm/bớt shuffle-card -->
<div class="shuffle-card"></div>
```

#### Tùy chỉnh animation
Trong `styles.css`:
```css
@keyframes shuffle1 {
    /* Custom animation here */
}
```

---

## 🎨 Design System

### Colors
```css
--primary-color: #7B68EE    /* Medium Purple */
--secondary-color: #9370DB  /* Medium Slate Blue */
--accent-color: #FFD700     /* Gold */
--glow-color: rgba(123, 104, 238, 0.5)
```

### Typography
- **Headings**: Cinzel (serif) - elegant & mystical
- **Body**: Raleway (sans-serif) - clean & modern

### Effects
- **Glassmorphism**: backdrop-filter blur(10px)
- **Glow**: box-shadow with glow-color
- **Smooth transitions**: 0.3s cubic-bezier

---

## 📱 Responsive Design

### Desktop (1400px+)
- Full sidebar (400px)
- 3-column grid for spreads
- Large cards
- All animations enabled

### Tablet (768px - 1400px)
- Full sidebar
- 2-column grid
- Medium cards
- All features work

### Mobile (< 768px)
- Full-width sidebar
- 1-column grid
- Smaller cards
- Controls stacked vertically
- Touch-optimized

---

## 🔧 Troubleshooting

### Nhạc không phát
- **Nguyên nhân**: Browser block autoplay
- **Giải pháp**: User phải click nút music để enable
- **Note**: Không thể autoplay khi load page

### Lịch sử bị mất
- **Nguyên nhân**: Clear browser cache/localStorage
- **Giải pháp**: Backup định kỳ (tính năng export/import)
- **Lưu ý**: localStorage limit ~5-10MB

### Theme không lưu
- **Nguyên nhân**: localStorage bị disable
- **Giải pháp**: Enable localStorage trong browser settings
- **Check**: console.log(localStorage)

### Chia sẻ không hoạt động
- **Nguyên nhân**: Popup blocker
- **Giải pháp**: Allow popups cho site
- **Alternative**: Sử dụng "Sao chép" thay vì share trực tiếp

### Animation lag
- **Nguyên nhân**: Device yếu
- **Giải pháp**: Giảm số particles, tắt một số effects
- **Optimize**: Reduce animation complexity

---

## 🚀 Performance Tips

### Tối ưu localStorage
```javascript
// Giới hạn số lượng history items
if (this.history.length > 50) {
    this.history = this.history.slice(0, 50);
}
```

### Tối ưu animations
```css
/* Sử dụng transform thay vì top/left */
transform: translateX(10px);  /* ✅ Good */
left: 10px;                    /* ❌ Bad */
```

### Lazy load images
```javascript
<img loading="lazy" src="...">
```

---

## 🎯 Future Enhancements

### Đề xuất tính năng mới
1. **Export PDF** - Xuất kết quả ra PDF
2. **Print** - In kết quả đẹp mắt
3. **Multiple languages** - Đa ngôn ngữ
4. **Voice reading** - Đọc kết quả bằng giọng nói
5. **Compare readings** - So sánh nhiều lần bói
6. **Statistics** - Thống kê lá bài xuất hiện nhiều
7. **Favorites** - Đánh dấu yêu thích
8. **Tags** - Gắn tag cho mỗi lần bói
9. **Search history** - Tìm kiếm trong lịch sử
10. **Cloud sync** - Đồng bộ giữa các thiết bị

---

## 📞 Support

### Báo lỗi
- Mở issue trên GitHub
- Email: support@tarotmystic.com
- Discord: TarotMystic#1234

### Đóng góp
- Fork repository
- Tạo pull request
- Follow code style

---

Made with ✨ magic and 💜 love by Tarot Mystic Team
