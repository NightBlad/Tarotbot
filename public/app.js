// Main Application Logic
class TarotApp {
    constructor() {
        this.currentSpread = null;
        this.apiUrl = 'https://tarotbot-astc.onrender.com'; // Tarot API URL
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
            // Only load if tarot API is configured
            if (!this.apiUrl || this.apiUrl.includes('localhost')) {
                console.log('Tarot API not available - skipping card suggestions');
                return;
            }
            
            const response = await fetch(`${this.apiUrl}/cards`);
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
        // Parse the text content
        const parsed = this.parseReadingText(text);
        
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

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // First line is typically the title
            if (!result.title && trimmed.length < 100) {
                result.title = trimmed;
                continue;
            }

            // Detect card lines (pattern: "Position: Card Name (Orientation)")
            const cardMatch = trimmed.match(/^([^:]+):\s*([^(]+)\s*\(([^)]+)\)/);
            if (cardMatch) {
                const position = cardMatch[1].trim();
                const name = cardMatch[2].trim();
                const orientation = cardMatch[3].trim();
                
                result.cards.push({
                    position: position,
                    name: name,
                    orientation: orientation.toLowerCase().includes('ngược') ? 'reversed' : 'upright'
                });
                continue;
            }

            // Detect conclusion
            if (trimmed.toLowerCase().includes('kết luận')) {
                inConclusion = true;
                currentSection = null;
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
            if (trimmed.includes('—')) {
                const parts = trimmed.split('—');
                if (parts.length >= 2) {
                    currentSection = {
                        title: parts[0].trim(),
                        content: parts.slice(1).join('—').trim()
                    };
                    result.sections.push(currentSection);
                }
                continue;
            }

            // Add to current section or create new one
            if (currentSection) {
                currentSection.content += ' ' + trimmed;
            }
        }

        return result;
    }

    displayCards(cards) {
        const container = document.getElementById('cardsDisplay');
        container.innerHTML = '';

        if (!cards || cards.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Không có thông tin lá bài</p>';
            return;
        }

        cards.forEach((card, index) => {
            const cardEl = document.createElement('div');
            cardEl.className = 'tarot-card';
            
            // Get card image URL (construct from card name or use placeholder)
            const imageUrl = this.getCardImageUrl(card.name);
            
            cardEl.innerHTML = `
                <div class="card-image-wrapper">
                    <img 
                        src="${imageUrl}" 
                        alt="${card.name}" 
                        class="card-image ${card.orientation === 'reversed' ? 'reversed' : ''}"
                        onerror="this.src='https://via.placeholder.com/180x300/7B68EE/FFFFFF?text=${encodeURIComponent(card.name)}'"
                    >
                </div>
                <div class="card-position">${card.position}</div>
                <div class="card-name">${card.name}</div>
                <div class="card-orientation">${card.orientation === 'reversed' ? '(Ngược)' : '(Xuôi)'}</div>
            `;
            
            container.appendChild(cardEl);
        });
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
