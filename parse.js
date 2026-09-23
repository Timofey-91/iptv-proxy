const fs = require('fs');

async function parseTivixMosfilm() {
  const pageUrl = 'http://live.tivix.co/450-mosfilm.html';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': pageUrl,
    'Origin': 'http://live.tivix.co'
  };

  try {
    // 1. Загружаем HTML страницы
    const response = await fetch(pageUrl, { headers });
    if (!response.ok) throw new Error(`Ошибка загрузки страницы: ${response.status}`);

    const html = await response.text();
    let rawStreamUrl = null;

    // 2. Извлекаем первичную ссылку из decode(...)
    const decodeMatch = html.match(/file:\s*decode\(["']([^"']+)["']\)/i);
    if (decodeMatch) {
      rawStreamUrl = Buffer.from(decodeMatch[1], 'base64').toString('utf-8');
    } else {
      const directMatch = html.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/i);
      if (directMatch) rawStreamUrl = directMatch[1];
    }

    if (!rawStreamUrl) throw new Error('Ссылка .m3u8 не найдена в коде страницы');
    if (rawStreamUrl.includes(']')) rawStreamUrl = rawStreamUrl.split(']').pop();

    console.log('[Tivix] Первичная ссылка:', rawStreamUrl);

    // 3. Запрашиваем первичную ссылку с redirect: 'manual', чтобы перехватить 302
    const res302 = await fetch(rawStreamUrl, {
      method: 'GET',
      headers: headers,
      redirect: 'manual'
    });

    let finalStreamUrl = rawStreamUrl;

    // Перехватываем Location из заголовка ответа 302
    const redirectLocation = res302.headers.get('location');
    if (redirectLocation) {
      finalStreamUrl = new URL(redirectLocation, rawStreamUrl).href;
      console.log('[Tivix] Перехвачен прямой URL из 302 Location:', finalStreamUrl);
    } else {
      console.log('[Tivix] Статус ответа:', res302.status, '(Location заголовок не найден)');
    }

    // 4. Записываем готовую прямую ссылку в streams.json
    fs.writeFileSync('streams.json', JSON.stringify({ mosfilm: finalStreamUrl }, null, 2));

  } catch (err) {
    console.error('[Tivix] Ошибка парсинга:', err.message);
    process.exit(1);
  }
}

parseTivixMosfilm();
