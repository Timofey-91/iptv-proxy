const fs = require('fs');

async function parseTivixMosfilm() {
  const url = 'http://live.tivix.co/450-mosfilm.html';
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'http://live.tivix.co/',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    let streamUrl = null;

    // 1. Поиск file: decode("...")
    const decodeMatch = html.match(/file:\s*decode\(["']([^"']+)["']\)/i);
    if (decodeMatch) {
      streamUrl = Buffer.from(decodeMatch[1], 'base64').toString('utf-8');
    }

    // 2. Поиск прямой ссылки .m3u8 в исходном коде
    if (!streamUrl) {
      const directMatch = html.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/i) || 
                          html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
      if (directMatch) {
        streamUrl = directMatch[1];
      }
    }

    // 3. Поиск ссылки на фрейм плеера (iframe)
    if (!streamUrl) {
      const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
      if (iframeMatch) {
        console.log('[Tivix] Найден iframe плеера:', iframeMatch[1]);
        // Если найден iframe, делаем запрос к нему
        let iframeUrl = iframeMatch[1];
        if (iframeUrl.startsWith('//')) iframeUrl = 'http:' + iframeUrl;
        
        const iframeRes = await fetch(iframeUrl, { headers: { 'Referer': url } });
        const iframeHtml = await iframeRes.text();
        
        const iframeDecode = iframeHtml.match(/file:\s*decode\(["']([^"']+)["']\)/i) ||
                             iframeHtml.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/i);
        if (iframeDecode) {
          streamUrl = iframeDecode[1].includes('decode') ? 
            Buffer.from(iframeDecode[1], 'base64').toString('utf-8') : iframeDecode[1];
        }
      }
    }

    if (!streamUrl) {
      console.log('--- ПРЕВЬЮ ПОЛУЧЕННОЙ СТРАНИЦЫ (ПЕРВЫЕ 500 СИМВОЛОВ) ---');
      console.log(html.slice(0, 500));
      console.log('------------------------------------------------------');
      throw new Error('Ссылка .m3u8 не найдена в исходном коде страницы');
    }

    // Очистка селектора качества [720p]
    if (streamUrl.includes(']')) {
      streamUrl = streamUrl.split(']').pop();
    }

    console.log('[Tivix] Успешно найдена ссылка:', streamUrl);

    const output = { mosfilm: streamUrl };
    fs.writeFileSync('streams.json', JSON.stringify(output, null, 2));

  } catch (err) {
    console.error('[Tivix] Ошибка парсинга:', err.message);
    process.exit(1);
  }
}

parseTivixMosfilm();
