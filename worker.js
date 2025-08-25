export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/+/, ""); // убираем "/"

    // Загружаем config.json с GitHub
    const configUrl = "https://raw.githubusercontent.com/Timofey-91/iptv-proxy/refs/heads/main/config.json";
    const configResp = await fetch(configUrl);
    const config = await configResp.json();

    if (!path || !(path in config)) {
      return new Response("Channel not found", { status: 404 });
    }

    const targetUrl = config[path];
    const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);

    // Загружаем плейлист с peers.tv
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

    // Переписываем все относительные ссылки на абсолютные
    text = text.replace(/^(?!#)(.*\.m3u8|.*\.ts)(.*)$/gm, (match) => {
      if (match.startsWith("http")) {
        return match; // уже абсолютная
      }
      return baseUrl + match;
    });

    return new Response(text, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
};
