const fs = require('fs');

async function parseTivixMosfilm() {
  const pageUrl = 'http://live.tivix.co/450-mosfilm.html';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': pageUrl,
    'Origin': 'http://live.tivix.co'
  };

  try {
    // 1. Получаем HTML
    const response = await fetch(pageUrl, { headers });
    const html = await response.text();

    const decodeMatch = html.match(/file:\s*decode\(["']([^"']+)["']\)/i);
    if (!decodeMatch) throw new Error('decode() не найден');

    let rawStreamUrl = Buffer.from(decodeMatch[1], 'base64').toString('utf-8');
    if (rawStreamUrl.includes(']')) rawStreamUrl = rawStreamUrl.split(']').pop();

    console.log('[1] Первичный URL:', rawStreamUrl);

    // 2. Делаем запрос с redirect: 'manual'
    const res302 = await fetch(rawStreamUrl, {
      method: 'GET',
      headers: headers,
      redirect: 'manual'
    });

    console.log('[2] Статус ответа сервера:', res302.status);
    
    // Выводим ВСЕ заголовки, которые прислал сервер
    console.log('[3] Заголовки ответа:');
    res302.headers.forEach((val, key) => console.log(`   ${key}: ${val}`));

    let finalStreamUrl = rawStreamUrl;
    const location = res302.headers.get('location');

    if (location) {
      finalStreamUrl = new URL(location, rawStreamUrl).href;
      console.log('[+] УСПЕХ! Прямой URL:', finalStreamUrl);
    } else {
      console.log('[-] Заголовок location отсутствует в ответе.');
    }

    fs.writeFileSync('streams.json', JSON.stringify({ mosfilm: finalStreamUrl }, null, 2));

  } catch (err) {
    console.error('Ошибка:', err.message);
    process.exit(1);
  }
}

parseTivixMosfilm();
