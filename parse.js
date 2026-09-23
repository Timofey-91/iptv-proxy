const fs = require('fs');

async function parseCdntvmedia() {
  const playerUrl = 'https://cdntvmedia.com/players/playerjs.php?ch=235&sp=5';
  const pageUrl = 'https://smotru.tv/mosfilm-zolotaya-kollektsiya.html';
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': pageUrl,
    'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'iframe',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site'
  };

  try {
    console.log(`[Player] Запрос плеера: ${playerUrl}`);
    const response = await fetch(playerUrl, { headers });
    if (!response.ok) throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);

    const html = await response.text();
    let rawStreamUrl = null;

    // 1. Ищем зашифрованную ссылку file: decode("...")
    const decodeMatch = html.match(/file:\s*decode\(["']([^"']+)["']\)/i);
    if (decodeMatch) {
      rawStreamUrl = Buffer.from(decodeMatch[1], 'base64').toString('utf-8');
    } else {
      const directMatch = html.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
                          html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
      if (directMatch) rawStreamUrl = directMatch[1];
    }

    if (!rawStreamUrl) {
      console.log('HTML плеера (первые 400 символов):', html.slice(0, 400));
      throw new Error('Ссылка .m3u8 не найдена в коде плеера');
    }

    if (rawStreamUrl.includes(']')) {
      rawStreamUrl = rawStreamUrl.split(']').pop();
    }

    console.log('[Player] Первичный URL потока:', rawStreamUrl);

    // 2. Запрос с redirect: 'manual' для перехвата редиректа токена
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
      console.log('[Player] Перехвачен финальный URL из Location:', finalStreamUrl);
    } else {
      console.log('[Player] Статус ответа потока:', res302.status);
    }

    // 3. Сохранение результата в streams.json
    fs.writeFileSync('streams.json', JSON.stringify({ mosfilm: finalStreamUrl }, null, 2));
    console.log('[Player] Успешно сохранено в streams.json');

  } catch (err) {
    console.error('[Error]:', err.message);
    process.exit(1);
  }
}

parseCdntvmedia();
