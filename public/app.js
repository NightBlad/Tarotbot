// Main Application Logic
class TarotApp {
    constructor() {
        this.currentSpread = null;
        this.apiUrl = '/api'; // Use local proxy endpoints
        this.langflowUrl = null; // Will be set from environment or config
        this.langflowKey = null;
        this.currentReading = null;
        this.history = [];
        this.musicEnabled = false;
        this.theme = 'dark';
        
        this.init();
    }

    init() {
        this.loadConfig();
        this.loadHistory();
        this.loadTheme();
        this.attachEventListeners();
        this.loadCardSuggestions();
    }
    
    loadHistory() {
        const saved = localStorage.getItem('tarot_history');
        if (saved) {
            try {
                this.history = JSON.parse(saved);
            } catch (e) {
                this.history = [];
            }
        }
    }
    
    saveHistory() {
        localStorage.setItem('tarot_history', JSON.stringify(this.history));
    }
    
    loadTheme() {
        const saved = localStorage.getItem('tarot_theme');
        if (saved) {
            this.theme = saved;
            if (this.theme === 'light') {
                document.body.classList.add('light-theme');
                document.querySelector('#themeToggle .icon').textContent = '☀️';
            }
        }
    }
    
    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        document.body.classList.toggle('light-theme');
        
        const icon = document.querySelector('#themeToggle .icon');
        icon.textContent = this.theme === 'light' ? '☀️' : '🌙';
        
        localStorage.setItem('tarot_theme', this.theme);
    }
    
    toggleMusic() {
        const music = document.getElementById('bgMusic');
        const btn = document.getElementById('musicToggle');
        
        this.musicEnabled = !this.musicEnabled;
        
        if (this.musicEnabled) {
            music.play();
            btn.classList.add('active');
        } else {
            music.pause();
            btn.classList.remove('active');
        }
    }

    async loadConfig() {
        // Try to load config from a config endpoint
        try {
            const response = await fetch('/api/config');
            if (response.ok) {
                const config = await response.json();
                this.apiUrl = config.tarotApiUrl || this.apiUrl;
                this.langflowUrl = config.langflowUrl;
                this.langflowKey = config.langflowKey;
            }
        } catch (e) {
            console.warn('Could not load config, using defaults');
        }
    }

    attachEventListeners() {
        // Spread card selection
        document.querySelectorAll('.spread-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const spread = e.currentTarget.dataset.spread;
                this.selectSpread(spread);
            });
        });

        // Back button
        document.getElementById('backBtn').addEventListener('click', () => {
            this.showHomePage();
        });

        // Divine button
        document.getElementById('divineBtn').addEventListener('click', () => {
            this.performReading();
        });
        
        // Control buttons
        document.getElementById('musicToggle').addEventListener('click', () => {
            this.toggleMusic();
        });
        
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });
        
        document.getElementById('historyToggle').addEventListener('click', () => {
            this.toggleHistory();
        });
        
        // History sidebar
        document.getElementById('closeHistory').addEventListener('click', () => {
            this.closeHistory();
        });
        
        document.getElementById('clearHistory').addEventListener('click', () => {
            this.clearHistory();
        });
        
        // Share buttons
        document.getElementById('shareBtn').addEventListener('click', () => {
            this.openShareModal();
        });
        
        document.getElementById('saveBtn').addEventListener('click', () => {
            this.saveCurrentReading();
        });
        
        // Share modal
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeShareModal();
            });
        });
        
        document.querySelectorAll('.share-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const platform = e.currentTarget.dataset.platform;
                this.shareReading(platform);
            });
        });
        
        document.getElementById('copyLinkBtn').addEventListener('click', () => {
            this.copyShareLink();
        });
        
        // Close modal on background click
        document.getElementById('shareModal').addEventListener('click', (e) => {
            if (e.target.id === 'shareModal') {
                this.closeShareModal();
            }
        });
    }
    
    toggleHistory() {
        const sidebar = document.getElementById('historySidebar');
        sidebar.classList.toggle('open');
        this.renderHistory();
    }
    
    closeHistory() {
        document.getElementById('historySidebar').classList.remove('open');
    }
    
    renderHistory() {
        const container = document.getElementById('historyContent');
        
        if (this.history.length === 0) {
            container.innerHTML = `
                <div class="empty-history">
                    <div class="empty-history-icon">📜</div>
                    <p>Chưa có lịch sử bói bài</p>
                    <p style="font-size: 0.9rem;">Các lần bói của bạn sẽ được lưu tại đây</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.history.map((item, index) => `
            <div class="history-item" data-index="${index}">
                <div class="history-item-header">
                    <div class="history-item-title">${this.escapeHtml(item.spreadTitle)}</div>
                    <div class="history-item-date">${this.formatDate(item.date)}</div>
                </div>
                ${item.question ? `<div class="history-item-question">❓ ${this.escapeHtml(item.question)}</div>` : ''}
                <div class="history-item-preview">${this.escapeHtml(item.preview)}</div>
            </div>
        `).join('');
        
        // Add click handlers
        container.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                this.loadHistoryItem(index);
            });
        });
    }
    
    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Vừa xong';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`;
        
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    clearHistory() {
        if (confirm('Bạn có chắc muốn xóa tất cả lịch sử bói bài?')) {
            this.history = [];
            this.saveHistory();
            this.renderHistory();
        }
    }
    
    loadHistoryItem(index) {
        const item = this.history[index];
        if (!item) return;
        
        this.currentReading = item.reading;
        this.currentSpread = item.spread;
        
        // Show reading page
        document.getElementById('homePage').classList.remove('active');
        document.getElementById('readingPage').classList.add('active');
        
        // Set title
        document.getElementById('spreadTitle').textContent = item.spreadTitle;
        
        // Set question
        document.getElementById('questionInput').value = item.question || '';
        
        // Display results
        this.displayResults(item.reading.text);
        
        // Close history sidebar
        this.closeHistory();
    }
    
    saveCurrentReading() {
        if (!this.currentReading) {
            alert('Không có kết quả để lưu');
            return;
        }
        
        const question = document.getElementById('questionInput').value.trim();
        const spreadTitles = {
            'one': '🎴 Một Lá Bài',
            'three': '🔮 Ba Lá Bài',
            'five': '⭐ Năm Lá Bài',
            'celtic-cross': '✝️ Celtic Cross',
            'past-present-future': '⏳ Quá Khứ / Hiện Tại / Tương Lai',
            'mind-body-spirit': '🧘 Tâm / Thân / Thần',
            'existing-relationship': '💑 Mối Quan Hệ Hiện Tại',
            'potential-relationship': '💝 Mối Quan Hệ Tiềm Năng',
            'making-decision': '🤔 Ra Quyết Định',
            'law-of-attraction': '🌟 Luật Hấp Dẫn',
            'release-retain': '🔄 Buông Bỏ & Giữ Lại',
            'asset-hindrance': '⚖️ Lợi Thế & Trở Ngại'
        };
        
        const historyItem = {
            spread: this.currentSpread,
            spreadTitle: spreadTitles[this.currentSpread] || this.currentSpread,
            question: question,
            date: Date.now(),
            reading: this.currentReading,
            preview: this.currentReading.text.substring(0, 100) + '...'
        };
        
        // Add to beginning of history
        this.history.unshift(historyItem);
        
        // Keep only last 50 readings
        if (this.history.length > 50) {
            this.history = this.history.slice(0, 50);
        }
        
        this.saveHistory();
        
        // Show feedback
        const btn = document.getElementById('saveBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="icon">✓</span> Đã lưu!';
        btn.style.background = '#10b981';
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = '';
        }, 2000);
    }
    
    openShareModal() {
        if (!this.currentReading) {
            alert('Không có kết quả để chia sẻ');
            return;
        }
        
        document.getElementById('shareModal').classList.add('active');
    }
    
    closeShareModal() {
        document.getElementById('shareModal').classList.remove('active');
    }
    
    shareReading(platform) {
        if (!this.currentReading) return;
        
        const question = document.getElementById('questionInput').value.trim();
        const title = document.getElementById('spreadTitle').textContent;
        const text = `${title}${question ? '\n\nCâu hỏi: ' + question : ''}\n\n${this.currentReading.text.substring(0, 200)}...`;
        const url = window.location.href;
        
        switch (platform) {
            case 'copy':
                this.copyToClipboard(text);
                alert('Đã sao chép nội dung!');
                break;
                
            case 'facebook':
                window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`, '_blank');
                break;
                
            case 'twitter':
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
                break;
                
            case 'whatsapp':
                window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`, '_blank');
                break;
                
            case 'telegram':
                window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
                break;
                
            case 'email':
                window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text + '\n\n' + url)}`;
                break;
        }
        
        this.closeShareModal();
    }
    
    copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
        } else {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
    }
    
    copyShareLink() {
        const link = window.location.href;
        this.copyToClipboard(link);
        
        const btn = document.getElementById('copyLinkBtn');
        const originalText = btn.textContent;
        btn.textContent = '✓ Đã sao chép';
        btn.style.background = '#10b981';
        
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
        }, 2000);
    }

    async loadCardSuggestions() {
        try {
            const response = await fetch('/api/cards');
            if (response.ok) {
                const data = await response.json();
                const cards = data.data || data;
                const datalist = document.getElementById('cardSuggestions');
                
                cards.forEach(card => {
                    const option = document.createElement('option');
                    option.value = card.name_short;
                    option.textContent = `${card.name} (${card.name_short})`;
                    datalist.appendChild(option);
                });
            }
        } catch (e) {
            console.log('Card suggestions not available:', e.message);
        }
    }

    selectSpread(spreadType) {
        this.currentSpread = spreadType;
        
        // Update spread title
        const titles = {
            'one': '🎴 Một Lá Bài',
            'three': '🔮 Ba Lá Bài',
            'five': '⭐ Năm Lá Bài',
            'celtic-cross': '✝️ Celtic Cross',
            'past-present-future': '⏳ Quá Khứ / Hiện Tại / Tương Lai',
            'mind-body-spirit': '🧘 Tâm / Thân / Thần',
            'existing-relationship': '💑 Mối Quan Hệ Hiện Tại',
            'potential-relationship': '💝 Mối Quan Hệ Tiềm Năng',
            'making-decision': '🤔 Ra Quyết Định',
            'law-of-attraction': '🌟 Luật Hấp Dẫn',
            'release-retain': '🔄 Buông Bỏ & Giữ Lại',
            'asset-hindrance': '⚖️ Lợi Thế & Trở Ngại'
        };
        
        document.getElementById('spreadTitle').textContent = titles[spreadType] || spreadType;
        
        // Show/hide significator input for law-of-attraction
        const sigGroup = document.getElementById('sigGroup');
        if (spreadType === 'law-of-attraction') {
            sigGroup.style.display = 'block';
        } else {
            sigGroup.style.display = 'none';
        }
        
        this.showReadingPage();
    }

    showHomePage() {
        document.getElementById('homePage').classList.add('active');
        document.getElementById('readingPage').classList.remove('active');
        
        // Reset form
        document.getElementById('questionInput').value = '';
        document.getElementById('sigInput').value = '';
        document.getElementById('resultsSection').style.display = 'none';
    }

    showReadingPage() {
        document.getElementById('homePage').classList.remove('active');
        document.getElementById('readingPage').classList.add('active');
    }

    async performReading() {
        const question = document.getElementById('questionInput').value.trim();
        const sig = document.getElementById('sigInput').value.trim();
        
        // Show shuffle animation
        document.getElementById('shuffleAnimation').style.display = 'block';
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('resultsSection').style.display = 'none';
        
        // Wait for shuffle animation (3 seconds)
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Hide shuffle, show loading
        document.getElementById('shuffleAnimation').style.display = 'none';
        document.getElementById('loadingState').style.display = 'block';
        
        try {
            // Call LangFlow API
            const result = await this.callLangFlow(this.currentSpread, question, sig);
            
            // Store current reading
            this.currentReading = {
                text: result,
                spread: this.currentSpread,
                question: question,
                sig: sig,
                timestamp: Date.now()
            };
            
            // Display results
            this.displayResults(result);
        } catch (error) {
            console.error('Reading error:', error);
            alert('Có lỗi xảy ra khi bói bài. Vui lòng thử lại.');
        } finally {
            document.getElementById('loadingState').style.display = 'none';
        }
    }

    async callLangFlow(spread, question, sig) {
        // Build the input for LangFlow
        const input = {
            spread: spread,
            question: question || '',
            sig: sig || null
        };

        // Use proxy endpoint to avoid CORS issues
        const url = `/api/langflow/${encodeURIComponent(spread)}`;

        const payload = {
            output_type: 'text',
            input_type: 'chat',
            input_value: JSON.stringify(input)
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`LangFlow API error: ${response.status} - ${errorText}`);
        }

        const responseText = await response.text();
        if (!responseText || responseText.trim() === '') {
            throw new Error('Empty response from LangFlow API');
        }

        const data = JSON.parse(responseText);
        
        // Extract text from LangFlow response
        return this.extractLangFlowOutput(data);
    }

    extractLangFlowOutput(data) {
        // Handle various LangFlow response formats
        if (typeof data === 'string') return data;
        
        // Try nested outputs structure
        if (data.outputs && Array.isArray(data.outputs)) {
            for (const output of data.outputs) {
                if (output.outputs) {
                    for (const nested of output.outputs) {
                        if (nested.results?.message?.data?.text) {
                            return nested.results.message.data.text;
                        }
                        if (nested.results?.message?.text) {
                            return nested.results.message.text;
                        }
                    }
                }
                if (output.results?.message?.data?.text) {
                    return output.results.message.data.text;
                }
                if (output.results?.message?.text) {
                    return output.results.message.text;
                }
            }
        }
        
        if (data.text) return data.text;
        if (data.output) return data.output;
        if (data.result) return data.result;
        if (data.data?.text) return data.data.text;
        
        return JSON.stringify(data);
    }

    displayResults(text) {
        console.log('=== displayResults ===');
        console.log('Raw text length:', text.length);
        console.log('Raw text preview:', text.substring(0, 500));
        
        // Extract image URLs from text
        const { cleanText, imageUrls } = this.extractImageUrls(text);
        console.log('Extracted image URLs:', imageUrls);
        console.log('Clean text preview:', cleanText.substring(0, 500));
        
        // Parse the cleaned text content
        const parsed = this.parseReadingText(cleanText);
        console.log('Parsed result:', parsed);
        console.log('Number of cards found:', parsed.cards.length);
        console.log('Cards:', parsed.cards);
        console.log('Sections:', parsed.sections);
        console.log('Conclusion length:', parsed.conclusion.length);
        
        // Add extracted images to cards
        if (imageUrls.length > 0) {
            imageUrls.forEach((url, index) => {
                if (parsed.cards[index]) {
                    parsed.cards[index].imageUrl = url;
                }
            });
        }
        
        // Display cards
        this.displayCards(parsed.cards);
        
        // Display reading content
        this.displayReadingContent(parsed);
        
        // Show results section
        document.getElementById('resultsSection').style.display = 'block';
        
        // Scroll to results
        document.getElementById('resultsSection').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }

    extractImageUrls(text) {
        // Regular expression to match image URLs (http/https)
        const urlRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|svg))/gi;
        const imageUrls = [];
        let cleanText = text;
        
        // Extract all image URLs
        const matches = text.match(urlRegex);
        if (matches) {
            matches.forEach(url => {
                imageUrls.push(url);
            });
            
            // Remove URLs from text
            cleanText = text.replace(urlRegex, '').trim();
        }
        
        // Normalize text: add line breaks before card patterns and conclusion
        cleanText = cleanText
            // Add newline before card patterns (number: card or position: card)
            .replace(/(\d+:\s*[A-Z][^(]+\([^)]+\))/g, '\n$1')
            // Add newline before "Kết luận:"
            .replace(/(Kết luận:)/gi, '\n$1')
            // Add newline before sections with em-dash
            .replace(/([^\n])\s+([A-Z][^—]+—)/g, '$1\n$2')
            // Clean up extra whitespace
            .replace(/\s+/g, ' ')
            .replace(/\s*\n\s*/g, '\n')
            .trim();
        
        console.log('After normalization:', cleanText);
        
        return { cleanText, imageUrls };
    }

    parseReadingText(text) {
        console.log('=== parseReadingText ===');
        console.log('Input text:', text);
        
        const result = {
            title: '',
            cards: [],
            sections: [],
            conclusion: ''
        };

        const lines = text.split('\n');
        console.log('Total lines:', lines.length);
        
        let currentSection = null;
        let inConclusion = false;
        let currentCardIndex = -1;

        // Spread position patterns to recognize structured positions
        const positionPatterns = {
            // Celtic Cross
            'present': 'Hiện Tại',
            'immediate challenge': 'Thách Thức Trước Mắt',
            'crossing': 'Cản Trở',
            'distant past': 'Quá Khứ Xa',
            'recent past': 'Quá Khứ Gần',
            'best outcome': 'Kết Quả Tốt Nhất',
            'conscious': 'Ý Thức',
            'immediate future': 'Tương Lai Gần',
            'subconscious': 'Tiềm Thức',
            'self': 'Bản Thân',
            'attitude': 'Thái Độ',
            'environment': 'Môi Trường',
            'others': 'Người Khác',
            'hopes and fears': 'Hy Vọng & Lo Sợ',
            'outcome': 'Kết Quả',
            
            // Three Card
            'past': 'Quá Khứ',
            'future': 'Tương Lai',
            
            // Five Card
            'situation': 'Tình Huống',
            'challenge': 'Thách Thức',
            
            // Mind Body Spirit
            'mind': 'Tâm Trí',
            'body': 'Cơ Thể',
            'spirit': 'Tinh Thần',
            
            // Relationship Spreads
            'me': 'Bạn',
            'them': 'Họ',
            'the bridge': 'Cầu Nối',
            'highest potential': 'Tiềm Năng Cao Nhất',
            'lowest potential': 'Tiềm Năng Thấp Nhất',
            'what love asks of me': 'Tình Yêu Yêu Cầu Gì',
            'message from the universe': 'Thông Điệp Vũ Trụ',
            'action to take': 'Hành Động',
            'what to release': 'Điều Cần Buông Bỏ',
            
            // Release Retain
            'release': 'Buông Bỏ',
            'retain': 'Giữ Lại',
            
            // Asset Hindrance
            'asset': 'Lợi Thế',
            'hindrance': 'Trở Ngại',
            
            // Advice from Universe
            'what you need to know': 'Điều Bạn Cần Biết',
            'a new perspective': 'Góc Nhìn Mới',
            
            // Law of Attraction
            'significator': 'Thẻ Đại Diện',
            'your current energy': 'Năng Lượng Hiện Tại',
            'the energy you need': 'Năng Lượng Cần Có',
            'how to get into alignment': 'Cách Điều Chỉnh',
            'letting go of the how': 'Buông Bỏ Cách Thức',
            
            // Making Decision
            'option 1': 'Lựa Chọn 1',
            'option 2': 'Lựa Chọn 2',
            'option 1 energy': 'Năng Lượng Lựa Chọn 1',
            'option 2 energy': 'Năng Lượng Lựa Chọn 2',
            'fears': 'Lo Sợ',
            'blessings': 'May Mắn'
        };

        // If only 1 line, try to extract cards using global regex first
        if (lines.length === 1) {
            console.log('Single line detected, using global regex extraction');
            const singleLine = lines[0];
            
            // Extract title first (before any cards)
            const titleMatch = singleLine.match(/^([^—]+?)(?=(?:[A-Z][^:]*:\s*[A-Z][^(]+\()|(?:[A-Z][^(]{3,}?\s*\([^)]+\)\s*—))/);
            if (titleMatch) {
                const titleText = titleMatch[1].trim();
                // Take first 2 sentences or up to 200 chars
                const sentences = titleText.split(/\.\s+/);
                result.title = sentences.slice(0, 2).join('. ').trim();
                if (!result.title.endsWith('.')) result.title += '.';
                console.log('Extracted title:', result.title);
            }
            
            // Pattern 1: With position prefix (Quá khứ: Card Name (Orientation) — Description)
            const cardPattern1 = /([^:.\n]+):\s*([^(]+?)\s*\(([^)]+)\)\s*(?:—|–)\s*([^.]+(?:\.[^.]*?){0,4}\.)/g;
            
            // Pattern 2: Without position (Card Name (Orientation) — Description)
            const cardPattern2 = /\s([A-Z][^(]{3,60}?)\s*\(([^)]+)\)\s*(?:—|–)\s*([^.]+(?:\.[^.]*?){0,4}\.)/g;
            
            let match;
            
            // First try pattern 1 (with position)
            cardPattern1.lastIndex = 0;
            while ((match = cardPattern1.exec(singleLine)) !== null) {
                const position = match[1].trim();
                const name = match[2].trim();
                const orientation = match[3].trim();
                let description = match[4].trim();
                
                console.log('Pattern 1 matched:', { position, name, orientation, description: description.substring(0, 50) });
                
                // Validate it's a card (not a section title)
                const isCard = orientation.toLowerCase().match(/xuôi|ngược|upright|reversed/);
                
                // Exclude invalid positions/names
                const posLower = position.toLowerCase();
                const nameLower = name.toLowerCase();
                const validPosition = !posLower.includes('trải bài') && 
                                     !posLower.includes('kết luận') &&
                                     position.length < 50;
                const validName = !nameLower.includes('kết luận') && 
                                 !nameLower.includes('trải bài') &&
                                 name.length > 2 && name.length < 80;
                
                if (isCard && validPosition && validName) {
                    // Translate position if it's a known pattern
                    let displayPosition = position;
                    if (posLower === 'quá khứ' || posLower === 'past') {
                        displayPosition = '1: Quá Khứ';
                    } else if (posLower === 'hiện tại' || posLower === 'present') {
                        displayPosition = '2: Hiện Tại';
                    } else if (posLower === 'tương lai' || posLower === 'future') {
                        displayPosition = '3: Tương Lai';
                    } else {
                        displayPosition = position;
                    }
                    
                    result.cards.push({
                        position: displayPosition,
                        name: name,
                        orientation: orientation.toLowerCase().includes('ngược') || orientation.toLowerCase().includes('reversed') ? 'reversed' : 'upright',
                        description: description
                    });
                    console.log('Added card (pattern 1):', displayPosition, '-', name);
                }
            }
            
            // If no cards found with pattern 1, try pattern 2 (without position)
            if (result.cards.length === 0) {
                console.log('No cards found with pattern 1, trying pattern 2');
                cardPattern2.lastIndex = 0;
                while ((match = cardPattern2.exec(singleLine)) !== null) {
                    const name = match[1].trim();
                    const orientation = match[2].trim();
                    let description = match[3].trim();
                    
                    console.log('Pattern 2 matched:', { name, orientation, description: description.substring(0, 50) });
                    
                    // Validate it's a card
                    const isCard = orientation.toLowerCase().match(/xuôi|ngược|upright|reversed/);
                    const validName = !name.toLowerCase().includes('kết luận') && 
                                     !name.toLowerCase().includes('trải bài') &&
                                     name.length > 2 && name.length < 80;
                    
                    if (isCard && validName) {
                        result.cards.push({
                            position: this.getCardPosition(result.cards.length),
                            name: name,
                            orientation: orientation.toLowerCase().includes('ngược') || orientation.toLowerCase().includes('reversed') ? 'reversed' : 'upright',
                            description: description
                        });
                        console.log('Added card (pattern 2):', name);
                    }
                }
            }
            
            // Extract conclusion
            const conclusionMatch = singleLine.match(/Kết luận:\s*(.+)/i);
            if (conclusionMatch) {
                result.conclusion = conclusionMatch[1].trim();
                console.log('Extracted conclusion:', result.conclusion.substring(0, 100));
            }
            
            console.log('=== Final parsed result (global regex) ===');
            console.log('Title:', result.title);
            console.log('Cards:', result.cards.length);
            console.log('Sections:', result.sections.length);
            console.log('Conclusion length:', result.conclusion.length);
            
            return result;
        }

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            console.log('Processing line:', trimmed);

            // Skip emoji-only lines or decorative elements
            if (/^[\u{1F300}-\u{1F9FF}]+$/u.test(trimmed)) {
                console.log('  -> Skipped: emoji-only line');
                continue;
            }

            // First non-emoji line is typically the title
            if (!result.title && trimmed.length < 150 && !trimmed.includes('(') && !trimmed.includes('—')) {
                result.title = trimmed;
                console.log('  -> Set as title:', result.title);
                continue;
            }

            // Detect card with position number: "1: Card Name (Orientation) — Description"
            const cardWithNumberMatch = trimmed.match(/^(\d+):\s*(.+?)\s*\(([^)]+)\)(?:\s*[—–]\s*(.+))?/);
            if (cardWithNumberMatch) {
                const posNum = cardWithNumberMatch[1];
                const name = cardWithNumberMatch[2].trim();
                const orientation = cardWithNumberMatch[3].trim();
                const description = cardWithNumberMatch[4] ? cardWithNumberMatch[4].trim() : '';
                
                console.log('  -> Matched numbered card:', { posNum, name, orientation, description });
                
                if (name.length < 50 && !name.toLowerCase().includes('kết luận')) {
                    result.cards.push({
                        position: `Vị Trí ${posNum}`,
                        name: name,
                        orientation: orientation.toLowerCase().includes('ngược') ? 'reversed' : 'upright',
                        description: description
                    });
                    currentCardIndex = result.cards.length - 1;
                    console.log('  -> Added card, currentCardIndex:', currentCardIndex);
                    continue;
                }
            }

            // Detect card with structured position: "Position: Card Name (Orientation) — Description"
            const cardWithPosMatch = trimmed.match(/^([^:]+):\s*(.+?)\s*\(([^)]+)\)(?:\s*[—–]\s*(.+))?/);
            if (cardWithPosMatch) {
                const position = cardWithPosMatch[1].trim();
                const name = cardWithPosMatch[2].trim();
                const orientation = cardWithPosMatch[3].trim();
                const description = cardWithPosMatch[4] ? cardWithPosMatch[4].trim() : '';
                
                console.log('  -> Matched position card:', { position, name, orientation, description });
                
                // Extract position number if present (e.g., "1: RELEASE" -> "1")
                const posNumberMatch = position.match(/^(\d+):\s*(.+)/);
                let displayPosition = position;
                
                if (posNumberMatch) {
                    const num = posNumberMatch[1];
                    const posName = posNumberMatch[2].trim().toLowerCase();
                    const translatedPos = positionPatterns[posName] || posNumberMatch[2].trim();
                    displayPosition = `${num}: ${translatedPos}`;
                    console.log('  -> Translated position:', displayPosition);
                }
                
                // Check if this looks like a card (not conclusion or section)
                // Cards have specific orientation keywords
                const isCard = orientation.toLowerCase().match(/xuôi|ngược|upright|reversed/);
                
                if (isCard && name.length < 80 && !name.toLowerCase().includes('kết luận')) {
                    result.cards.push({
                        position: displayPosition,
                        name: name,
                        orientation: orientation.toLowerCase().includes('ngược') || orientation.toLowerCase().includes('reversed') ? 'reversed' : 'upright',
                        description: description
                    });
                    currentCardIndex = result.cards.length - 1;
                    console.log('  -> Added card, currentCardIndex:', currentCardIndex);
                    continue;
                } else {
                    console.log('  -> Not a card (isCard:', isCard, 'name.length:', name.length, ')');
                }
            }

            // Detect card with description using em dash: "Card Name (Orientation) — Description"
            const cardWithDescMatch = trimmed.match(/^[\u{1F300}-\u{1F9FF}\s]*(.+?)\s*\(([^)]+)\)\s*[—–]\s*(.+)/u);
            if (cardWithDescMatch) {
                const name = cardWithDescMatch[1].trim();
                const orientation = cardWithDescMatch[2].trim();
                const description = cardWithDescMatch[3].trim();
                
                console.log('  -> Matched em-dash card:', { name, orientation, description });
                
                // Check if orientation looks valid
                const isCard = orientation.toLowerCase().match(/xuôi|ngược|upright|reversed/);
                
                // Only add if it looks like a card name (not too long)
                if (isCard && name.length < 80 && !name.toLowerCase().includes('kết luận')) {
                    result.cards.push({
                        position: this.getCardPosition(result.cards.length),
                        name: name,
                        orientation: orientation.toLowerCase().includes('ngược') || orientation.toLowerCase().includes('reversed') ? 'reversed' : 'upright',
                        description: description
                    });
                    currentCardIndex = result.cards.length - 1;
                    console.log('  -> Added card, currentCardIndex:', currentCardIndex);
                    continue;
                } else {
                    console.log('  -> Not a card (isCard:', isCard, 'name.length:', name.length, ')');
                }
            }

            // Detect card lines with emoji prefix: "🔹 Card Name (Orientation)"
            const cardWithEmojiMatch = trimmed.match(/^[\u{1F300}-\u{1F9FF}\s]*(.+?)\s*\(([^)]+)\)/u);
            if (cardWithEmojiMatch) {
                const name = cardWithEmojiMatch[1].trim();
                const orientation = cardWithEmojiMatch[2].trim();
                
                console.log('  -> Matched emoji card:', { name, orientation });
                
                // Check if orientation looks valid
                const isCard = orientation.toLowerCase().match(/xuôi|ngược|upright|reversed/);
                
                // Only add if it looks like a card name (not a section title)
                if (isCard && name.length < 80 && !name.toLowerCase().includes('kết luận')) {
                    result.cards.push({
                        position: this.getCardPosition(result.cards.length),
                        name: name,
                        orientation: orientation.toLowerCase().includes('ngược') || orientation.toLowerCase().includes('reversed') ? 'reversed' : 'upright',
                        description: ''
                    });
                    currentCardIndex = result.cards.length - 1;
                    console.log('  -> Added card, currentCardIndex:', currentCardIndex);
                    continue;
                } else {
                    console.log('  -> Not a card (isCard:', isCard, 'name.length:', name.length, ')');
                }
            }

            // Detect conclusion with emoji or "Kết luận:"
            if (trimmed.toLowerCase().includes('kết luận') || /^[\u{1F300}-\u{1F9FF}]+\s*kết luận/iu.test(trimmed)) {
                inConclusion = true;
                currentSection = null;
                currentCardIndex = -1;
                console.log('  -> Entering conclusion section');
                const match = trimmed.match(/kết luận[:\s]*(.*)/i);
                if (match && match[1]) {
                    result.conclusion += match[1] + '\n';
                }
                continue;
            }

            // If in conclusion, accumulate text
            if (inConclusion) {
                console.log('  -> Adding to conclusion');
                result.conclusion += trimmed + '\n';
                continue;
            }

            // Detect section with em dash (but not card lines)
            if (trimmed.includes('—') && !trimmed.match(/\([^)]+\)/)) {
                const parts = trimmed.split('—');
                if (parts.length >= 2) {
                    currentSection = {
                        title: parts[0].trim(),
                        content: parts.slice(1).join('—').trim()
                    };
                    result.sections.push(currentSection);
                    currentCardIndex = -1;
                }
                continue;
            }

            // Add to current context (section, card description, or skip)
            if (currentSection) {
                console.log('  -> Adding to section:', currentSection.title);
                currentSection.content += ' ' + trimmed;
            } else if (currentCardIndex >= 0 && result.cards[currentCardIndex]) {
                // Add to the current card's description
                console.log('  -> Adding to card description, cardIndex:', currentCardIndex);
                if (result.cards[currentCardIndex].description) {
                    result.cards[currentCardIndex].description += ' ' + trimmed;
                } else {
                    result.cards[currentCardIndex].description = trimmed;
                }
            } else {
                console.log('  -> Line not processed (no context)');
            }
        }

        console.log('=== Final parsed result ===');
        console.log('Title:', result.title);
        console.log('Cards:', result.cards.length);
        console.log('Sections:', result.sections.length);
        console.log('Conclusion length:', result.conclusion.length);

        return result;
    }

    getCardPosition(index) {
        // Map based on current spread type if available
        const spreadPositions = {
            'celtic-cross': [
                '1: Hiện Tại',
                '2: Thách Thức (Cản Trở)',
                '3: Quá Khứ Xa',
                '4: Quá Khứ Gần',
                '5: Kết Quả Tốt Nhất',
                '6: Tương Lai Gần',
                '7: Bản Thân',
                '8: Môi Trường',
                '9: Hy Vọng & Lo Sợ',
                '10: Kết Quả'
            ],
            'three': [
                '1: Quá Khứ',
                '2: Hiện Tại',
                '3: Tương Lai'
            ],
            'past-present-future': [
                '1: Quá Khứ',
                '2: Hiện Tại',
                '3: Tương Lai'
            ],
            'five': [
                '1: Tình Huống',
                '2: Thách Thức',
                '3: Ý Thức',
                '4: Tiềm Thức',
                '5: Kết Quả'
            ],
            'mind-body-spirit': [
                '1: Tâm Trí',
                '2: Cơ Thể',
                '3: Tinh Thần'
            ],
            'existing-relationship': [
                '1: Bạn',
                '2: Họ',
                '3: Cầu Nối',
                '4: Tiềm Năng Cao Nhất',
                '5: Tiềm Năng Thấp Nhất'
            ],
            'potential-relationship': [
                '1: Bạn',
                '2: Tình Yêu Yêu Cầu',
                '3: Thông Điệp Vũ Trụ',
                '4: Hành Động',
                '5: Điều Cần Buông Bỏ'
            ],
            'release-retain': [
                '1: Buông Bỏ',
                '2: Giữ Lại'
            ],
            'asset-hindrance': [
                '1: Lợi Thế',
                '2: Trở Ngại'
            ],
            'advice-universe': [
                '1: Điều Bạn Cần Biết',
                '2: Góc Nhìn Mới',
                '3: Hành Động'
            ],
            'law-of-attraction': [
                '1: Thẻ Đại Diện',
                '2: Năng Lượng Hiện Tại',
                '3: Năng Lượng Cần Có',
                '4: Cách Điều Chỉnh',
                '5: Buông Bỏ Cách Thức'
            ],
            'making-decision': [
                '1: Lựa Chọn 1',
                '2: Lựa Chọn 2',
                '3: Năng Lượng LC1',
                '4: Năng Lượng LC2',
                '5: Lo Sợ',
                '6: May Mắn'
            ]
        };

        // Try to get position from current spread type
        if (this.currentSpread && spreadPositions[this.currentSpread]) {
            const positions = spreadPositions[this.currentSpread];
            if (index < positions.length) {
                return positions[index];
            }
        }

        // Default fallback
        return `Lá Bài ${index + 1}`;
    }

    displayCards(cards) {
        const container = document.getElementById('cardsDisplay');
        container.innerHTML = '';

        if (!cards || cards.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Không có thông tin lá bài</p>';
            return;
        }

        // Use detailed layout for 1-2 cards with descriptions, grid for 3+ or no descriptions
        const useDetailedLayout = cards.length <= 2 && cards.some(card => card.description);

        cards.forEach((card, index) => {
            if (useDetailedLayout) {
                // Detailed card layout
                const cardEl = document.createElement('div');
                cardEl.className = 'tarot-card-detail';
                
                const imageUrl = card.imageUrl || this.getCardImageUrl(card.name);
                
                cardEl.innerHTML = `
                    <div class="card-detail-container">
                        <div class="card-detail-image">
                            <div class="card-image-wrapper">
                                <img 
                                    src="${imageUrl}" 
                                    alt="${card.name}" 
                                    class="card-image ${card.orientation === 'reversed' ? 'reversed' : ''}"
                                    onerror="this.src='https://via.placeholder.com/200x350/7B68EE/FFFFFF?text=${encodeURIComponent(card.name)}'"
                                >
                            </div>
                        </div>
                        <div class="card-detail-info">
                            <div class="card-detail-header">
                                <h3 class="card-detail-name">${this.escapeHtml(card.name)}</h3>
                                <span class="card-detail-orientation ${card.orientation}">${card.orientation === 'reversed' ? 'Ngược' : 'Xuôi'}</span>
                            </div>
                            <div class="card-detail-position">${this.escapeHtml(card.position)}</div>
                            ${card.description ? `
                                <div class="card-detail-description">
                                    <p>${this.escapeHtml(card.description)}</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
                
                container.appendChild(cardEl);
            } else {
                // Grid card layout (compact for multiple cards)
                const cardEl = document.createElement('div');
                cardEl.className = 'tarot-card';
                
                const imageUrl = card.imageUrl || this.getCardImageUrl(card.name);
                
                cardEl.innerHTML = `
                    <div class="card-image-wrapper">
                        <img 
                            src="${imageUrl}" 
                            alt="${card.name}" 
                            class="card-image ${card.orientation === 'reversed' ? 'reversed' : ''}"
                            onerror="this.src='https://via.placeholder.com/180x300/7B68EE/FFFFFF?text=${encodeURIComponent(card.name)}'"
                        >
                    </div>
                    <div class="card-position">${this.escapeHtml(card.position)}</div>
                    <div class="card-name">${this.escapeHtml(card.name)}</div>
                    <div class="card-orientation ${card.orientation}">${card.orientation === 'reversed' ? '(Ngược)' : '(Xuôi)'}</div>
                `;
                
                container.appendChild(cardEl);
            }
        });

        // If there are card descriptions in grid layout, show them as sections
        if (!useDetailedLayout && cards.some(card => card.description)) {
            cards.forEach(card => {
                if (card.description) {
                    const descEl = document.createElement('div');
                    descEl.className = 'card-description-section';
                    descEl.innerHTML = `
                        <h4 class="card-desc-title">
                            <span>🔹</span>
                            ${this.escapeHtml(card.position)}: ${this.escapeHtml(card.name)} (${card.orientation === 'reversed' ? 'Ngược' : 'Xuôi'})
                        </h4>
                        <p class="card-desc-text">${this.escapeHtml(card.description)}</p>
                    `;
                    container.appendChild(descEl);
                }
            });
        }
    }

    getCardImageUrl(cardName) {
        // Try to construct image URL from card name
        // This assumes your API has images at /images/{shortname}.jpg
        // You may need to adjust this based on your actual API structure
        
        // For now, use a placeholder that shows the card name
        // You can replace this with actual image URLs from your API
        return `${this.apiUrl}/images/${encodeURIComponent(cardName.toLowerCase().replace(/\s+/g, '-'))}.jpg`;
    }

    displayReadingContent(parsed) {
        const container = document.getElementById('resultsContent');
        container.innerHTML = '';

        // Display sections
        parsed.sections.forEach(section => {
            const sectionEl = document.createElement('div');
            sectionEl.className = 'result-section';
            sectionEl.innerHTML = `
                <h3 class="result-title">
                    <span>🔹</span>
                    ${this.escapeHtml(section.title)}
                </h3>
                <p class="result-text">${this.escapeHtml(section.content)}</p>
            `;
            container.appendChild(sectionEl);
        });

        // Display conclusion
        if (parsed.conclusion) {
            const conclusionEl = document.createElement('div');
            conclusionEl.className = 'conclusion-section';
            conclusionEl.innerHTML = `
                <h3 class="result-title">
                    <span>🔮</span>
                    Kết Luận
                </h3>
                <p class="result-text">${this.escapeHtml(parsed.conclusion)}</p>
            `;
            container.appendChild(conclusionEl);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/\n/g, '<br>');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new TarotApp();
});
