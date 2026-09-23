const fs = require('fs');

async function parseTivixMosfilm() {
  const url = 'http://live.tivix.co/450-mosfilm.html';
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'http://live.tivix.co/'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const html = await response.text();
    let streamUrl = null;

    // 1. Поиск file: decode("...")
    const decodeMatch = html.match(/file:\s*decode\(["']([^"']+)["']\)/i);
    if (decodeMatch) {
      streamUrl = Buffer.from(decodeMatch[1], 'base64').toString('utf-8');
    } else {
      // 2. Поиск прямой ссылки
      const directMatch = html.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/i);
      if (directMatch) {
        streamUrl = directMatch[1];
      }
    }

    if (!streamUrl) {
      throw new Error('Ссылка .m3u8 не найдена в исходном коде страницы');
    }

    // Убираем селекторы качества [720p]
    if (streamUrl.includes(']')) {
      streamUrl = streamUrl.split(']').pop();
    }

    console.log('[Tivix] Найдена ссылка:', streamUrl);

    // Сохраняем результат
    const output = { mosfilm: streamUrl };
    fs.writeFileSync('streams.json', JSON.stringify(output, null, 2));

  } catch (err) {
    console.error('[Tivix] Ошибка парсинга:', err.message);
    process.exit(1);
  }
}

parseTivixMosfilm();
