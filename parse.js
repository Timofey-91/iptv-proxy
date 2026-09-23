const fs = require('fs');

async function parseStream() {
  try {
    const response = await fetch('http://rodnoetv.com/mosfilm.html', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const html = await response.text();
    // Ищем строку file:decode("BASE64")
    const match = html.match(/file:\s*decode\(["']([^"']+)["']\)/);

    if (!match || !match[1]) {
      throw new Error("Не удалось найти Base64 строку");
    }

    const path = Buffer.from(match[1], 'base64').toString('utf-8');
    const streamUrl = `http://rodnoetv.com${path}`;

    // Сохраняем в JSON
    const data = {
      mosfilm: streamUrl,
      updated_at: new Date().toISOString()
    };

    fs.writeFileSync('streams.json', JSON.stringify(data, null, 2));
    console.log('Ссылка успешно обновлена:', streamUrl);
  } catch (error) {
    console.error('Ошибка парсинга:', error);
    process.exit(1);
  }
}

parseStream();
