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
        // Extract image URLs from text
        const { cleanText, imageUrls } = this.extractImageUrls(text);
        
        // Parse the cleaned text content
        const parsed = this.parseReadingText(cleanText);
        
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
            // Clean up extra whitespace
            cleanText = cleanText.replace(/\s+/g, ' ').replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n');
        }
        
        return { cleanText, imageUrls };
    }

    parseReadingText(text) {
        const result = {
            title: '',
            cards: [],
            sections: [],
            conclusion: ''
        };

        const lines = text.split('\n');
        let currentSection = null;
        let inConclusion = false;
        let currentCardIndex = -1;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Skip emoji-only lines or decorative elements
            if (/^[\u{1F300}-\u{1F9FF}]+$/u.test(trimmed)) {
                continue;
            }

            // First non-emoji line is typically the title
            if (!result.title && trimmed.length < 150 && !trimmed.includes('(') && !trimmed.includes('—')) {
                result.title = trimmed;
                continue;
            }

            // Detect card lines with description using em dash: "Card Name (Orientation) — Description"
            const cardWithDescMatch = trimmed.match(/^[\u{1F300}-\u{1F9FF}\s]*(.+?)\s*\(([^)]+)\)\s*[—–]\s*(.+)/u);
            if (cardWithDescMatch) {
                const name = cardWithDescMatch[1].trim();
                const orientation = cardWithDescMatch[2].trim();
                const description = cardWithDescMatch[3].trim();
                
                // Only add if it looks like a card name (not too long)
                if (name.length < 50 && !name.toLowerCase().includes('kết luận')) {
                    result.cards.push({
                        position: this.getCardPosition(result.cards.length),
                        name: name,
                        orientation: orientation.toLowerCase().includes('ngược') ? 'reversed' : 'upright',
                        description: description
                    });
                    currentCardIndex = result.cards.length - 1;
                    continue;
                }
            }

            // Detect card lines with colon: "Position: Card Name (Orientation) — Description"
            const cardWithPosMatch = trimmed.match(/^([^:]+):\s*(.+?)\s*\(([^)]+)\)(?:\s*[—–]\s*(.+))?/);
            if (cardWithPosMatch) {
                const position = cardWithPosMatch[1].trim();
                const name = cardWithPosMatch[2].trim();
                const orientation = cardWithPosMatch[3].trim();
                const description = cardWithPosMatch[4] ? cardWithPosMatch[4].trim() : '';
                
                // Check if position looks like a card position (not a section title)
                if (name.length < 50 && !name.toLowerCase().includes('kết luận')) {
                    result.cards.push({
                        position: position,
                        name: name,
                        orientation: orientation.toLowerCase().includes('ngược') ? 'reversed' : 'upright',
                        description: description
                    });
                    currentCardIndex = result.cards.length - 1;
                    continue;
                }
            }

            // Detect card lines with emoji prefix: "🔹 Card Name (Orientation)"
            const cardWithEmojiMatch = trimmed.match(/^[\u{1F300}-\u{1F9FF}\s]*(.+?)\s*\(([^)]+)\)/u);
            if (cardWithEmojiMatch) {
                const name = cardWithEmojiMatch[1].trim();
                const orientation = cardWithEmojiMatch[2].trim();
                
                // Only add if it looks like a card name (not a section title)
                if (name.length < 50 && !name.toLowerCase().includes('kết luận')) {
                    result.cards.push({
                        position: this.getCardPosition(result.cards.length),
                        name: name,
                        orientation: orientation.toLowerCase().includes('ngược') ? 'reversed' : 'upright',
                        description: ''
                    });
                    currentCardIndex = result.cards.length - 1;
                    continue;
                }
            }

            // Detect conclusion with emoji or "Kết luận:"
            if (trimmed.toLowerCase().includes('kết luận') || /^[\u{1F300}-\u{1F9FF}]+\s*kết luận/iu.test(trimmed)) {
                inConclusion = true;
                currentSection = null;
                currentCardIndex = -1;
                const match = trimmed.match(/kết luận[:\s]*(.*)/i);
                if (match && match[1]) {
                    result.conclusion += match[1] + '\n';
                }
                continue;
            }

            // If in conclusion, accumulate text
            if (inConclusion) {
                result.conclusion += trimmed + '\n';
                continue;
            }

            // Detect section with em dash
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
                currentSection.content += ' ' + trimmed;
            } else if (currentCardIndex >= 0 && result.cards[currentCardIndex]) {
                // Add to the current card's description
                if (result.cards[currentCardIndex].description) {
                    result.cards[currentCardIndex].description += ' ' + trimmed;
                } else {
                    result.cards[currentCardIndex].description = trimmed;
                }
            }
        }

        return result;
    }

    getCardPosition(index) {
        const positions = {
            0: 'Lá Bài 1',
            1: 'Lá Bài 2',
            2: 'Lá Bài 3',
            3: 'Lá Bài 4',
            4: 'Lá Bài 5',
            5: 'Lá Bài 6',
            6: 'Lá Bài 7',
            7: 'Lá Bài 8',
            8: 'Lá Bài 9',
            9: 'Lá Bài 10'
        };
        return positions[index] || `Lá Bài ${index + 1}`;
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
