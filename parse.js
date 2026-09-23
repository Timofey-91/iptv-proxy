const fs = require('fs');

async function parseTivixMosfilm() {
  const pageUrl = 'http://live.tivix.co/450-mosfilm.html';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': pageUrl
  };

  try {
    // 1. Загружаем HTML страницы
    const response = await fetch(pageUrl, { headers });
    console.log(`[Tivix] Статус ответа страницы: ${response.status}`);

    const html = await response.text();
    let rawStreamUrl = null;

    // 2. Расширенный поиск ссылки на плеер (Base64 decode или прямой URL)
    const decodeMatch = html.match(/file:\s*decode\(["']([^"']+)["']\)/i) || 
                        html.match(/decode\(["']([^"']+)["']\)/i);
    
    if (decodeMatch && decodeMatch[1]) {
      try {
        rawStreamUrl = Buffer.from(decodeMatch[1], 'base64').toString('utf-8');
      } catch (e) {
        console.warn('[Tivix] Ошибка Base64 декодирования:', e.message);
      }
    }

    if (!rawStreamUrl) {
      const directMatch = html.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/i) || 
                          html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
      if (directMatch) rawStreamUrl = directMatch[1];
    }

    // Если ссылка не найдена — выводим полученный HTML в консоль для отладки
    if (!rawStreamUrl) {
      console.error('[Tivix] Не удалось найти плеер. Ответ сервера (первые 400 символов):');
      console.log('--------------------------------------------------');
      console.log(html.slice(0, 400));
      console.log('--------------------------------------------------');
      throw new Error('Ссылка .m3u8 не найдена в коде страницы');
    }

    // Очищаем префиксы качества вида [720p]
    if (rawStreamUrl.includes(']')) {
      rawStreamUrl = rawStreamUrl.split(']').pop();
    }

    console.log('[Tivix] Первичная ссылка:', rawStreamUrl);

    // 3. Запрос к index.m3u8?k=... с redirect: 'manual' для перехвата 302 Redirect (Location)
    const res302 = await fetch(rawStreamUrl, {
      method: 'GET',
      headers: {
        'User-Agent': headers['User-Agent'],
        'Referer': pageUrl,
        'Origin': 'http://live.tivix.co'
      },
      redirect: 'manual'
    });

    let finalStreamUrl = rawStreamUrl;
    const locationHeader = res302.headers.get('location');

    if (locationHeader) {
      finalStreamUrl = new URL(locationHeader, rawStreamUrl).href;
      console.log('[Tivix] Перехвачен прямой URL из 302 Location:', finalStreamUrl);
    } else {
      console.warn(`[Tivix] Ответ ${res302.status} без заголовка Location. Сохраняем первичную ссылку.`);
    }

    // 4. Записываем итоговую ссылку в streams.json
    fs.writeFileSync('streams.json', JSON.stringify({ mosfilm: finalStreamUrl }, null, 2));
    console.log('[Tivix] Успешно сохранен streams.json');

  } catch (err) {
    console.error('[Tivix] Ошибка парсинга:', err.message);
    process.exit(1);
  }
}

parseTivixMosfilm();
