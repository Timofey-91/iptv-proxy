const fs = require('fs');

async function parseTivixMosfilm() {
  const pageUrl = 'http://live.tivix.co/450-mosfilm.html';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Referer': 'http://live.tivix.co/'
  };

  try {
    // 1. Загружаем HTML страницы
    const response = await fetch(pageUrl, { headers });
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const html = await response.text();
    let rawStreamUrl = null;

    // 2. Находим декодированную ссылку file: decode("...")
    const decodeMatch = html.match(/file:\s*decode\(["']([^"']+)["']\)/i);
    if (decodeMatch) {
      rawStreamUrl = Buffer.from(decodeMatch[1], 'base64').toString('utf-8');
    } else {
      const directMatch = html.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/i);
      if (directMatch) rawStreamUrl = directMatch[1];
    }

    if (!rawStreamUrl) throw new Error('Ссылка не найдена в исходном коде страницы');

    // Убираем маркеры качества вида [720p]
    if (rawStreamUrl.includes(']')) {
      rawStreamUrl = rawStreamUrl.split(']').pop();
    }

    console.log('[Tivix] Первичная ссылка:', rawStreamUrl);

    // 3. Переходим по 302-редиректу для получения прямой ссылки с хэшем
    let finalStreamUrl = rawStreamUrl;
    try {
      const resRedirect = await fetch(rawStreamUrl, {
        method: 'GET',
        headers: headers,
        redirect: 'follow'
      });
      
      if (resRedirect.url && resRedirect.url !== rawStreamUrl) {
        finalStreamUrl = resRedirect.url;
        console.log('[Tivix] Успешно получена прямая ссылка с хэшем:', finalStreamUrl);
      }
    } catch (e) {
      console.warn('[Tivix] Предупреждение при редиректе, используем первичную ссылку:', e.message);
    }

    // 4. Записываем результат в streams.json
    const output = { mosfilm: finalStreamUrl };
    fs.writeFileSync('streams.json', JSON.stringify(output, null, 2));

  } catch (err) {
    console.error('[Tivix] Ошибка парсинга:', err.message);
    process.exit(1);
  }
}

parseTivixMosfilm();
