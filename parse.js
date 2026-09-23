const fs = require('fs');

async function parseMosfilm() {
  // Запрос идет напрямую к плееру cdntvmedia, который отдает плеер для канала 235
  const playerUrl = 'https://cdntvmedia.com/players/playerjs.php?ch=235&sp=5';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'http://live.tivix.co/'
  };

  try {
    const response = await fetch(playerUrl, { headers });
    if (!response.ok) throw new Error(`Ошибка загрузки плеера: ${response.status}`);

    const html = await response.text();
    let rawStreamUrl = null;

    // 1. Ищем file: decode("...") внутри скрипта плеера cdntvmedia
    const decodeMatch = html.match(/file:\s*decode\(["']([^"']+)["']\)/i);
    if (decodeMatch) {
      rawStreamUrl = Buffer.from(decodeMatch[1], 'base64').toString('utf-8');
    } else {
      // 2. Альтернативный поиск прямой .m3u8 ссылки
      const directMatch = html.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/i);
      if (directMatch) rawStreamUrl = directMatch[1];
    }

    if (!rawStreamUrl) {
      console.error('HTML плеера (первые 300 символов):\n', html.slice(0, 300));
      throw new Error('Ссылка .m3u8 не найдена в коде плеера cdntvmedia');
    }

    if (rawStreamUrl.includes(']')) {
      rawStreamUrl = rawStreamUrl.split(']').pop();
    }

    console.log('[Player] Первичный URL:', rawStreamUrl);

    // 3. Делаем запрос с redirect: 'manual' для перехвата 302 Location (как мы делали раньше)
    const res302 = await fetch(rawStreamUrl, {
      method: 'GET',
      headers: {
        'User-Agent': headers['User-Agent'],
        'Referer': 'https://cdntvmedia.com/',
        'Origin': 'https://cdntvmedia.com'
      },
      redirect: 'manual'
    });

    let finalStreamUrl = rawStreamUrl;
    const locationHeader = res302.headers.get('location');

    if (locationHeader) {
      finalStreamUrl = new URL(locationHeader, rawStreamUrl).href;
      console.log('[Player] Перехвачен прямой URL из Location:', finalStreamUrl);
    }

    // 4. Сохраняем в streams.json
    fs.writeFileSync('streams.json', JSON.stringify({ mosfilm: finalStreamUrl }, null, 2));
    console.log('[Player] Успешно сохранено в streams.json');

  } catch (err) {
    console.error('Ошибка:', err.message);
    process.exit(1);
  }
}

parseMosfilm();
