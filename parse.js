const fs = require('fs');

async function parseWithChain() {
  const pageUrl = 'https://smotru.tv/mosfilm-zolotaya-kollektsiya.html';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  };

  try {
    console.log('[1] Шаг 1: Запрос страницы smotru.tv для получения сессии...');
    const pageRes = await fetch(pageUrl, { headers });
    if (!pageRes.ok) throw new Error(`Ошибка загрузки smotru.tv: ${pageRes.status}`);

    // Собираем куки, если они выдаются сайтом
    let cookies = '';
    if (typeof pageRes.headers.getSetCookie === 'function') {
      cookies = pageRes.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
    } else {
      const rawCookie = pageRes.headers.get('set-cookie');
      if (rawCookie) cookies = rawCookie.split(',').map(c => c.split(';')[0]).join('; ');
    }

    const pageHtml = await pageRes.text();

    // Ищем ссылку на фрейм/плеер прямо в коде страницы smotru.tv
    // Обычно это https://cdntvmedia.com/movies/... или players/playerjs.php
    let playerUrl = null;
    const iframeMatch = pageHtml.match(/src=["'](https?:\/\/[^"']*cdntvmedia\.com[^"']+)["']/i);
    
    if (iframeMatch) {
      playerUrl = iframeMatch[1];
    } else {
      // Запасной вариант, если структура изменилась — бьем на прямой адрес плеера канала 235
      playerUrl = 'https://cdntvmedia.com/players/playerjs.php?ch=235&sp=5';
    }

    console.log('[2] Шаг 2: Запрос плеера:', playerUrl);

    const playerHeaders = {
      ...headers,
      'Referer': pageUrl,
      'Sec-Fetch-Dest': 'iframe',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'cross-site'
    };
    if (cookies) playerHeaders['Cookie'] = cookies;

    const playerRes = await fetch(playerUrl, { headers: playerHeaders });
    if (!playerRes.ok) throw new Error(`Ошибка загрузки плеера (403/503): ${playerRes.status}`);

    const playerHtml = await playerRes.text();
    let rawStreamUrl = null;

    // 3. Извлекаем зашифрованную ссылку file: decode("...")
    const decodeMatch = playerHtml.match(/file:\s*decode\(["']([^"']+)["']\)/i);
    if (decodeMatch) {
      rawStreamUrl = Buffer.from(decodeMatch[1], 'base64').toString('utf-8');
    } else {
      const directMatch = playerHtml.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
                          playerHtml.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
      if (directMatch) rawStreamUrl = directMatch[1];
    }

    if (!rawStreamUrl) {
      throw new Error('Ссылка .m3u8 не найдена в коде плеера');
    }

    if (rawStreamUrl.includes(']')) {
      rawStreamUrl = rawStreamUrl.split(']').pop();
    }

    console.log('[3] Первичный URL потока:', rawStreamUrl);

    // 4. Перехватываем 302 редирект для получения финального хэша
    let finalStreamUrl = rawStreamUrl;
    const res302 = await fetch(rawStreamUrl, {
      method: 'GET',
      headers: {
        'User-Agent': headers['User-Agent'],
        'Referer': 'https://cdntvmedia.com/',
        'Origin': 'https://cdntvmedia.com'
      },
      redirect: 'manual'
    });

    const locationHeader = res302.headers.get('location');
    if (locationHeader) {
      finalStreamUrl = new URL(locationHeader, rawStreamUrl).href;
      console.log('[4] Успешно перехвачен финальный URL:', finalStreamUrl);
    }

    // 5. Запись в streams.json
    fs.writeFileSync('streams.json', JSON.stringify({ mosfilm: finalStreamUrl }, null, 2));
    console.log('[✓] Готово! Сохранено в streams.json');

  } catch (err) {
    console.error('[Error]:', err.message);
    process.exit(1);
  }
}

parseWithChain();
