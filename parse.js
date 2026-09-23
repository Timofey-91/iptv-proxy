const fs = require('fs');

async function parseSmotruMosfilm() {
  const pageUrl = 'https://smotru.tv/mosfilm-zolotaya-kollektsiya.html';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://smotru.tv/'
  };

  try {
    console.log(`[Smotru] Запрос страницы: ${pageUrl}`);
    const response = await fetch(pageUrl, { headers });
    if (!response.ok) throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);

    const html = await response.text();
    let rawStreamUrl = null;

    // 1. Поиск прямого m3u8 или файла в коде страницы
    const directMatch = html.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
                        html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
    if (directMatch) {
      rawStreamUrl = directMatch[1];
    }

    // 2. Если не нашли, ищем iframe плеере на странице
    if (!rawStreamUrl) {
      const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
      if (iframeMatch) {
        let iframeUrl = iframeMatch[1];
        if (iframeUrl.startsWith('//')) iframeUrl = 'https:' + iframeUrl;
        else if (iframeUrl.startsWith('/')) iframeUrl = new URL(iframeUrl, pageUrl).href;

        console.log('[Smotru] Найден iframe, переходим в него:', iframeUrl);
        const iframeRes = await fetch(iframeUrl, { headers: { ...headers, 'Referer': pageUrl } });
        const iframeHtml = await iframeRes.text();

        // Ищем m3u8 или decode внутри iframe
        const iframeDecode = iframeHtml.match(/file:\s*decode\(["']([^"']+)["']\)/i);
        if (iframeDecode) {
          rawStreamUrl = Buffer.from(iframeDecode[1], 'base64').toString('utf-8');
        } else {
          const iframeDirect = iframeHtml.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
                               iframeHtml.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
          if (iframeDirect) rawStreamUrl = iframeDirect[1];
        }
      }
    }

    // 3. Поиск через eval / сжатые скрипты, если стандартные методы не сработали
    if (!rawStreamUrl) {
      // Ищем любые упоминания внешних скриптов плееров или доменов потоков
      const scriptMatches = [...html.matchAll(/src=["']([^"']+\.js[^"']*)["']/g)];
      for (const match of scriptMatches) {
        let scriptUrl = match[1];
        if (scriptUrl.startsWith('//')) scriptUrl = 'https:' + scriptUrl;
        else if (scriptUrl.startsWith('/')) scriptUrl = new URL(scriptUrl, pageUrl).href;
        else continue;

        try {
          const scriptRes = await fetch(scriptUrl, { headers: { ...headers, 'Referer': pageUrl } });
          const scriptText = await scriptRes.text();
          const m3u8InScript = scriptText.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/i);
          if (m3u8InScript) {
            rawStreamUrl = m3u8InScript[0];
            break;
          }
        } catch (e) {
          // Игнорируем ошибки загрузки сторонних скриптов
        }
      }
    }

    if (!rawStreamUrl) {
      console.log('--- ПРЕВЬЮ HTML (ПЕРВЫЕ 500 СИМВОЛОВ) ---');
      console.log(html.slice(0, 500));
      console.log('-----------------------------------------');
      throw new Error('Ссылка .m3u8 не найдена на странице smotru.tv');
    }

    if (rawStreamUrl.includes(']')) {
      rawStreamUrl = rawStreamUrl.split(']').pop();
    }

    console.log('[Smotru] Найден первичный URL:', rawStreamUrl);

    // 4. Обработка 302 редиректа для получения финальной рабочей ссылки с хэшем
    let finalStreamUrl = rawStreamUrl;
    try {
      const res302 = await fetch(rawStreamUrl, {
        method: 'GET',
        headers: {
          'User-Agent': headers['User-Agent'],
          'Referer': pageUrl,
          'Origin': 'https://smotru.tv'
        },
        redirect: 'manual'
      });

      const locationHeader = res302.headers.get('location');
      if (locationHeader) {
        finalStreamUrl = new URL(locationHeader, rawStreamUrl).href;
        console.log('[Smotru] Перехвачен прямой URL из Location:', finalStreamUrl);
      }
    } catch (e) {
      console.warn('[Smotru] Предупреждение при проверке редиректа:', e.message);
    }

    // 5. Запись результата
    fs.writeFileSync('streams.json', JSON.stringify({ mosfilm: finalStreamUrl }, null, 2));
    console.log('[Smotru] Успешно записано в streams.json');

  } catch (err) {
    console.error('[Smotru] Ошибка парсинга:', err.message);
    process.exit(1);
  }
}

parseSmotruMosfilm();
