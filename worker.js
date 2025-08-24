export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/+/, ""); // убираем "/"

    // Загружаем config.json из GitHub
    const configUrl = "https://raw.githubusercontent.com/Timofey-91/iptv-proxy/refs/heads/main/config.json";
    const configResp = await fetch(configUrl);
    const config = await configResp.json();

    if (!path || !(path in config)) {
      return new Response("Channel not found", { status: 404 });
    }

    const targetUrl = config[path];

    // Берём плейлист у peers.tv
    const resp = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 8.0.1;)",
        "Referer": "https://peers.tv/"
      }
    });

    if (!resp.ok) {
      return new Response("Upstream error", { status: resp.status });
    }

    let text = await resp.text();

    // ⚡ Фикс: убираем вставку воркера перед ссылками
    // Если в плейлисте уже абсолютные http/https — оставляем как есть
    text = text.replace(/(https?:\/\/[^\s]+)/g, (match) => match);

    return new Response(text, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
};
