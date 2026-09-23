const fs = require('fs');

async function parseTivixMosfilm() {
  const pageUrl = 'http://live.tivix.co/450-mosfilm.html';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'http://live.tivix.co/'
  };

  try {
    // 1. Получаем HTML страницы
    const response = await fetch(pageUrl, { headers });
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const html = await response.text();
    let rawStreamUrl = null;

    // 2. Ищем зашифрованную или прямую ссылку
    const decodeMatch = html.match(/file:\s*decode\(["']([^"']+)["']\)/i);
    if (decodeMatch) {
      rawStreamUrl = Buffer.from(decodeMatch[1], 'base64').toString('utf-8');
    } else {
      const directMatch = html.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/i) || 
                          html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
      if (directMatch) rawStreamUrl = directMatch[1];
    }

    if (!rawStreamUrl) throw new Error('Ссылка .m3u8 не найдена в коде страницы');

    if (rawStreamUrl.includes(']')) {
      rawStreamUrl = rawStreamUrl.split(']').pop();
    }

    console.log('[Tivix] Первичная ссылка:', rawStreamUrl);

    // 3. Отключаем автопереход и забираем точный URL из заголовка Location
    let finalStreamUrl = rawStreamUrl;
    const resRedirect = await fetch(rawStreamUrl, {
      method: 'GET',
      headers: headers,
      redirect: 'manual'
    });

    const locationHeader = resRedirect.headers.get('location');
    if (locationHeader) {
      // Преобразуем относительный URL в абсолютный, если нужно
      finalStreamUrl = new URL(locationHeader, rawStreamUrl).href;
      console.log('[Tivix] Перехвачен прямой URL из Location:', finalStreamUrl);
    } else {
      console.warn('[Tivix] Заголовок Location не получен, сохранен первичный URL');
    }

    // 4. Записываем в streams.json
    fs.writeFileSync('streams.json', JSON.stringify({ mosfilm: finalStreamUrl }, null, 2));

  } catch (err) {
    console.error('[Tivix] Ошибка парсинга:', err.message);
    process.exit(1);
  }
}

parseTivixMosfilm();
