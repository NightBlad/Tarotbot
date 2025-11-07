const nodeHtmlToImage = require('node-html-to-image');
const fs = require('fs');
const path = require('path');

/**
 * Render tarot cards to a single image
 * @param {Array} cards - Array of card objects with { name, image, orientation, position }
 * @param {Object} options - Rendering options { title, spread }
 * @returns {Promise<Buffer>} - Image buffer
 */
async function renderCardsToImage(cards, options = {}) {
  const { title = 'Trải Bài Tarot', spread = 'unknown' } = options;
  
  // Determine layout based on number of cards
  const cardCount = cards.length;
  let layout = 'horizontal';
  let columns = cardCount;
  
  if (cardCount > 5) {
    layout = 'grid';
    columns = Math.ceil(Math.sqrt(cardCount));
  } else if (cardCount === 1) {
    layout = 'single';
    columns = 1;
  }
  
  // Build HTML for cards
  const cardHtml = cards.map((card, index) => {
    const rotation = card.orientation === 'reversed' ? 'transform: rotate(180deg);' : '';
    const cardName = card.name || 'Unknown Card';
    const position = card.position || `Card ${index + 1}`;
    
    return `
      <div class="card-container">
        <div class="card-position">${position}</div>
        <div class="card-wrapper">
          <img src="${card.image}" alt="${cardName}" class="card-image" style="${rotation}" />
        </div>
        <div class="card-name">${cardName}</div>
        <div class="card-orientation">${card.orientation === 'reversed' ? '(Ngược)' : '(Xuôi)'}</div>
      </div>
    `;
  }).join('');
  
  // HTML template
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 40px;
          min-height: 100vh;
        }
        
        .container {
          background: rgba(255, 255, 255, 0.95);
          border-radius: 20px;
          padding: 40px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          max-width: ${layout === 'single' ? '400px' : '1200px'};
          margin: 0 auto;
        }
        
        .title {
          text-align: center;
          color: #764ba2;
          font-size: 36px;
          font-weight: bold;
          margin-bottom: 40px;
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(${columns}, 1fr);
          gap: 30px;
          justify-items: center;
          align-items: start;
        }
        
        .card-container {
          text-align: center;
          max-width: 200px;
        }
        
        .card-position {
          font-size: 14px;
          font-weight: bold;
          color: #667eea;
          text-transform: uppercase;
          margin-bottom: 10px;
          letter-spacing: 1px;
        }
        
        .card-wrapper {
          background: white;
          border-radius: 15px;
          padding: 10px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
          margin-bottom: 15px;
          transition: transform 0.3s;
        }
        
        .card-image {
          width: 100%;
          height: auto;
          border-radius: 10px;
          display: block;
        }
        
        .card-name {
          font-size: 16px;
          font-weight: bold;
          color: #333;
          margin-bottom: 5px;
        }
        
        .card-orientation {
          font-size: 14px;
          color: #666;
          font-style: italic;
        }
        
        @media (max-width: 768px) {
          .cards-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="title">${title}</div>
        <div class="cards-grid">
          ${cardHtml}
        </div>
      </div>
    </body>
    </html>
  `;
  
  // Render to image
  const image = await nodeHtmlToImage({
    html,
    quality: 100,
    type: 'png',
    puppeteerArgs: {
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    },
    encoding: 'buffer'
  });
  
  return image;
}

/**
 * Save rendered image to temp file
 * @param {Buffer} imageBuffer - Image buffer
 * @param {String} filename - Filename without extension
 * @returns {Promise<String>} - Full path to saved file
 */
async function saveImageToTemp(imageBuffer, filename = 'tarot_spread') {
  const tempDir = path.join(__dirname, 'temp');
  
  // Create temp directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const filePath = path.join(tempDir, `${filename}_${Date.now()}.png`);
  
  await fs.promises.writeFile(filePath, imageBuffer);
  
  return filePath;
}

/**
 * Clean up old temp files (older than 1 hour)
 */
async function cleanupTempFiles() {
  const tempDir = path.join(__dirname, 'temp');
  
  if (!fs.existsSync(tempDir)) return;
  
  const files = await fs.promises.readdir(tempDir);
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  for (const file of files) {
    const filePath = path.join(tempDir, file);
    const stats = await fs.promises.stat(filePath);
    
    if (now - stats.mtimeMs > oneHour) {
      try {
        await fs.promises.unlink(filePath);
        console.log(`Cleaned up old temp file: ${file}`);
      } catch (err) {
        console.warn(`Failed to delete temp file ${file}:`, err.message);
      }
    }
  }
}

// Run cleanup on startup and every 30 minutes
cleanupTempFiles();
setInterval(cleanupTempFiles, 30 * 60 * 1000);

module.exports = {
  renderCardsToImage,
  saveImageToTemp,
  cleanupTempFiles
};
