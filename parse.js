const fs = require('fs');

async function parseTivixMosfilm() {
  const pageUrl = 'http://live.tivix.co/450-mosfilm.html';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'http://live.tivix.co/'
  };

  try {
    const response = await fetch(pageUrl, { headers });
    console.log(`[Tivix] Статус ответа: ${response.status}`);

    const html = await response.text();

    // Проверка на заглушку антибота
    if (html.includes('cf-browser-verification') || html.includes('ddos-guard') || html.includes('Just a moment')) {
      console.error('[Tivix] Запрос заблокирован антиботом (Cloudflare/DDoS-Guard).');
      console.log('Первые 300 символов ответа:\n', html.slice(0, 300));
      process.exit(1);
    }

    let rawStreamUrl = null;

    // 1. Поиск file: decode("...")
    const decodeMatch = html.match(/file:\s*decode\(["']([^"']+)["']\)/i);
    if (decodeMatch) {
      rawStreamUrl = Buffer.from(decodeMatch[1], 'base64').toString('utf-8');
    } else {
      // 2. Поиск прямой ссылки
      const directMatch = html.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/i) || 
                          html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
      if (directMatch) rawStreamUrl = directMatch[1];
    }

    if (!rawStreamUrl) {
      console.log('--- Содержимое HTML (первые 500 символов) ---');
      console.log(html.slice(0, 500));
      console.log('-------------------------------------------');
      throw new Error('Ссылка .m3u8 не найдена в исходном коде страницы');
    }

    if (rawStreamUrl.includes(']')) {
      rawStreamUrl = rawStreamUrl.split(']').pop();
    }

    console.log('[Tivix] Первичная ссылка:', rawStreamUrl);

    // Получаем прямую ссылку с хэшем
    let finalStreamUrl = rawStreamUrl;
    try {
      const resRedirect = await fetch(rawStreamUrl, {
        headers,
        redirect: 'follow'
      });
      if (resRedirect.url && resRedirect.url !== rawStreamUrl) {
        finalStreamUrl = resRedirect.url;
        console.log('[Tivix] Финальная ссылка:', finalStreamUrl);
      }
    } catch (e) {
      console.warn('[Tivix] Ошибка при редиректе, используется первичный URL:', e.message);
    }

    fs.writeFileSync('streams.json', JSON.stringify({ mosfilm: finalStreamUrl }, null, 2));

  } catch (err) {
    console.error('[Tivix] Ошибка парсинга:', err.message);
    process.exit(1);
  }
}

parseTivixMosfilm();
