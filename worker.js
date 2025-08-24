export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/+/, ""); // убираем "/"

    // Загружаем config.json из GitHub Pages
    const configUrl = "https://raw.githubusercontent.com/USERNAME/iptv-proxy/main/config.json";
    const configResp = await fetch(configUrl);
    const config = await configResp.json();

    if (!path || !(path in config)) {
      return new Response("Channel not found", { status: 404 });
    }

    const targetUrl = config[path];
    return fetch(targetUrl, {
      headers: {
        "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 8.0.1;)",
        "Referer": "https://peers.tv/"
      }
    });
  }
};
