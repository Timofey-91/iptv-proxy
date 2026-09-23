const fs = require('fs');

async function parseStream() {
  // Проверьте точный URL страницы (например: http://rodnoetv.com/smotret/msflmgold)
  const TARGET_URL = 'https://xittv.net/mosfilm.html'; 

  try {
    const response = await fetch(TARGET_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache'
      }
    });

    console.log(`Статус ответа сервера: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      throw new Error(`Сервер вернул ошибку: ${response.status}`);
    }

    const html = await response.text();

    // 1. Проверяем формат file: decode("...")
    // 2. Проверяем прямую Base64 строку file: "..."
    const matchDecode = html.match(/file:\s*decode\(["']([^"']+)["']\)/i);
    const matchDirect = html.match(/file:\s*["']([^"']+)["']/i);

    const encodedString = matchDecode ? matchDecode[1] : (matchDirect ? matchDirect[1] : null);

    if (!encodedString) {
      console.error("=== ФРАГМЕНТ HTML ДЛЯ ОТЛАДКИ ===");
      console.error(html.slice(0, 1000)); // Выводим первые 1000 символов полученной страницы
      console.error("===============================");
      throw new Error("Не удалось найти зашифрованную строку файла в коде страницы");
    }

    // Декодируем из Base64, если строка не начинается сразу с '/' или 'http'
    let path = encodedString;
    if (!path.startsWith('/') && !path.startsWith('http')) {
      path = Buffer.from(encodedString, 'base64').toString('utf-8');
    }

    const streamUrl = path.startsWith('http') ? path : `http://xittv.net${path}`;

    const data = {
      mosfilm: streamUrl,
      updated_at: new Date().toISOString()
    };

    fs.writeFileSync('streams.json', JSON.stringify(data, null, 2));
    console.log('Ссылка успешно обновлена:', streamUrl);

  } catch (error) {
    console.error('Ошибка парсинга:', error.message);
    process.exit(1);
  }
}

parseStream();
