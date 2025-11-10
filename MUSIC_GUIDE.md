# 🎵 Hướng Dẫn Thêm Nhạc Nền

## Cách 1: Sử dụng Nhạc Online (Đơn giản nhất)

File `index.html` đã được cập nhật với nhiều nguồn nhạc miễn phí.

### Nguồn nhạc miễn phí tốt:

1. **Pixabay Audio** (Miễn phí, không bản quyền)
   - https://pixabay.com/music/
   - Tìm kiếm: "meditation", "ambient", "mystical"

2. **Mixkit** (Miễn phí)
   - https://mixkit.co/free-stock-music/
   - Category: Meditation, Ambient

3. **Free Music Archive**
   - https://freemusicarchive.org/
   - Genre: Ambient, New Age

4. **YouTube Audio Library**
   - https://studio.youtube.com/channel/UC.../music
   - (Cần tài khoản YouTube)

## Cách 2: Tải Nhạc Về Máy (KHUYÊN DÙNG)

### Bước 1: Tạo thư mục music

```bash
mkdir public/music
```

### Bước 2: Tải nhạc meditation miễn phí

**Option A: Từ Pixabay**
1. Vào https://pixabay.com/music/
2. Tìm "meditation" hoặc "mystical"
3. Chọn bài thích → Download MP3
4. Đổi tên file thành `background.mp3`
5. Copy vào `public/music/background.mp3`

**Option B: Từ Mixkit**
1. Vào https://mixkit.co/free-stock-music/
2. Chọn category "Meditation"
3. Download bài thích hợp
4. Lưu vào `public/music/background.mp3`

**Option C: Sử dụng Freesound**
1. Vào https://freesound.org/
2. Tìm "meditation music" hoặc "ambient drone"
3. Filter: License = CC0 (Public Domain)
4. Download và lưu

### Bước 3: Cập nhật HTML

Sửa file `public/index.html`:

```html
<!-- Audio Player (Hidden) -->
<audio id="bgMusic" loop>
    <source src="/music/background.mp3" type="audio/mpeg">
</audio>
```

## Cách 3: Sử dụng Nhiều Bài Nhạc (Playlist)

### Tạo playlist tự động chuyển bài:

1. Tải nhiều file nhạc vào `public/music/`:
   - `track1.mp3`
   - `track2.mp3`
   - `track3.mp3`

2. Cập nhật `app.js`:

```javascript
// Thêm vào class TarotApp
constructor() {
    // ... existing code
    this.playlist = [
        '/music/track1.mp3',
        '/music/track2.mp3',
        '/music/track3.mp3'
    ];
    this.currentTrack = 0;
}

toggleMusic() {
    const music = document.getElementById('bgMusic');
    const btn = document.getElementById('musicToggle');
    
    this.musicEnabled = !this.musicEnabled;
    
    if (this.musicEnabled) {
        this.playNextTrack();
        btn.classList.add('active');
        
        // Auto play next track when current ends
        music.addEventListener('ended', () => {
            this.playNextTrack();
        });
    } else {
        music.pause();
        btn.classList.remove('active');
    }
}

playNextTrack() {
    const music = document.getElementById('bgMusic');
    music.src = this.playlist[this.currentTrack];
    music.play();
    this.currentTrack = (this.currentTrack + 1) % this.playlist.length;
}
```

## Cách 4: Tạo Nhạc Bằng Web Audio API (Tự động tạo âm thanh)

Không cần file nhạc, tự động tạo âm thanh huyền bí:

```javascript
// Thêm vào app.js
class AmbientSoundGenerator {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.isPlaying = false;
    }
    
    start() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        
        // Create ambient drone
        const oscillator1 = this.audioContext.createOscillator();
        const oscillator2 = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator1.type = 'sine';
        oscillator1.frequency.setValueAtTime(110, this.audioContext.currentTime); // A2
        
        oscillator2.type = 'sine';
        oscillator2.frequency.setValueAtTime(220, this.audioContext.currentTime); // A3
        
        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        
        oscillator1.connect(gainNode);
        oscillator2.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator1.start();
        oscillator2.start();
        
        this.oscillator1 = oscillator1;
        this.oscillator2 = oscillator2;
        this.gainNode = gainNode;
    }
    
    stop() {
        if (!this.isPlaying) return;
        this.oscillator1.stop();
        this.oscillator2.stop();
        this.isPlaying = false;
    }
}
```

## Gợi Ý Nhạc Nền Tốt Cho Tarot

### Thể loại phù hợp:
- ✅ Meditation / Relaxation
- ✅ Ambient / Drone
- ✅ New Age
- ✅ Crystal Bowl / Singing Bowl
- ✅ Nature Sounds + Music
- ✅ Binaural Beats
- ✅ Tibetan Bells
- ✅ Piano Ambient

### Đặc điểm nên có:
- 🎵 Không lời (instrumental)
- 🔊 Âm lượng nhẹ nhàng
- ⏱️ Dài ít nhất 3-5 phút
- 🔁 Loop được tự nhiên
- 🎹 Tần số thấp, thư giãn

### Các file nhạc gợi ý tìm trên Pixabay:
1. "Deep Meditation" - Meditation music
2. "Peaceful Piano" - Piano ambient
3. "Crystal Singing Bowls" - Healing sounds
4. "Mystical Journey" - New age
5. "Ambient Drone" - Dark ambient

## Troubleshooting

### Nhạc không phát
1. **Kiểm tra console** (F12):
   - Có lỗi CORS?
   - File path đúng chưa?

2. **Kiểm tra browser policy**:
   - Một số browser chặn autoplay
   - User phải tương tác (click) trước

3. **Kiểm tra format**:
   - MP3 hỗ trợ tốt nhất
   - OGG backup cho Firefox
   - AAC cho Safari

### Nhạc bị lag
1. Giảm chất lượng file (64kbps đủ cho background)
2. Sử dụng file local thay vì online
3. Preload audio: `<audio preload="auto">`

### Volume quá lớn/nhỏ
Thêm control volume:

```javascript
toggleMusic() {
    const music = document.getElementById('bgMusic');
    music.volume = 0.3; // 30% volume
    // ... rest of code
}
```

## Quick Start (Nhanh nhất)

1. Tải file này: https://pixabay.com/music/meditation-deep-meditation-111.mp3
2. Đặt vào `public/music/background.mp3`
3. Sửa `index.html`:
   ```html
   <audio id="bgMusic" loop>
       <source src="/music/background.mp3" type="audio/mpeg">
   </audio>
   ```
4. Restart server: `node web_server.js`
5. Refresh trang và click nút 🎵

Xong! 🎉
