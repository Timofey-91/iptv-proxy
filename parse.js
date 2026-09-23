const fs = require('fs');

async function parseTivixMosfilm() {
  const pageUrl = 'http://live.tivix.co/450-mosfilm.html';
  const baseHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': pageUrl
  };

  try {
    // 1. Получаем HTML страницы и куки сессии
    const response = await fetch(pageUrl, { headers: baseHeaders });
    if (!response.ok) throw new Error(`Ошибка загрузки HTML страницы: ${response.status}`);

    let cookies = '';
    if (typeof response.headers.getSetCookie === 'function') {
      cookies = response.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
    } else {
      const rawCookie = response.headers.get('set-cookie');
      if (rawCookie) cookies = rawCookie.split(',').map(c => c.split(';')[0]).join('; ');
    }

    const html = await response.text();
    let rawStreamUrl = null;

    // 2. Извлекаем зашифрованную ссылку из decode("...")
    const decodeMatch = html.match(/file:\s*decode\(["']([^"']+)["']\)/i) || 
                        html.match(/decode\(["']([^"']+)["']\)/i);

    if (decodeMatch && decodeMatch[1]) {
      rawStreamUrl = Buffer.from(decodeMatch[1], 'base64').toString('utf-8');
    } else {
      const directMatch = html.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/i) || 
                          html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
      if (directMatch) rawStreamUrl = directMatch[1];
    }

    if (!rawStreamUrl) {
      console.error('Не удалось найти плеер. Ответ сервера (первые 300 символов):\n', html.slice(0, 300));
      throw new Error('Ссылка .m3u8 не найдена в исходном коде');
    }

    if (rawStreamUrl.includes(']')) {
      rawStreamUrl = rawStreamUrl.split(']').pop();
    }

    console.log('[Tivix] Первичный URL плейлиста:', rawStreamUrl);

    // 3. Делаем запрос к первичному URL с redirect: 'manual' для перехвата 302
    const streamHeaders = {
      'User-Agent': baseHeaders['User-Agent'],
      'Referer': pageUrl,
      'Origin': 'http://live.tivix.co',
      'Accept': '*/*'
    };

    if (cookies) streamHeaders['Cookie'] = cookies;

    const res302 = await fetch(rawStreamUrl, {
      method: 'GET',
      headers: streamHeaders,
      redirect: 'manual'
    });

    let finalStreamUrl = rawStreamUrl;
    const locationHeader = res302.headers.get('location');

    // 4. Перехватываем относительный Location и преобразуем в абсолютную ссылку
    if (locationHeader) {
      finalStreamUrl = new URL(locationHeader, rawStreamUrl).href;
      console.log('[Tivix] Перехвачена прямая ссылка из 302 Location:', finalStreamUrl);
    } else {
      console.warn(`[Tivix] Заголовок Location не получен (статус ${res302.status}). Сохранен первичный URL.`);
    }

    // 5. Записываем результат в streams.json
    fs.writeFileSync('streams.json', JSON.stringify({ mosfilm: finalStreamUrl }, null, 2));
    console.log('[Tivix] Поток успешно сохранен в streams.json');

  } catch (err) {
    console.error('[Tivix] Ошибка парсинга:', err.message);
    process.exit(1);
  }
}

parseTivixMosfilm();
