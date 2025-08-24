export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // 📂 config.json в GitHub (raw)
      const CONFIG_URL = "https://raw.githubusercontent.com/USERNAME/iptv-proxy/main/config.json";

      // Загружаем config.json
      const configResp = await fetch(CONFIG_URL, { cache: "no-store" });
      const config = await configResp.json();

      // --- Обработка плейлиста ---
      if (path.endsWith(".m3u8")) {
        const channel = path.split("/").pop().replace(".m3u8", "");
        if (!(channel in config)) {
          return new Response("Channel not found", { status: 404 });
        }

        const realUrl = config[channel];
        const resp = await fetch(realUrl, {
          headers: {
            "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 8.0.1;)",
            "Referer": "https://peers.tv/",
          },
        });

        let playlist = await resp.text();

        // Переписываем сегменты → /channel/tvc+4/seg.ts
        playlist = playlist.replace(
          /([^\s]+\.tc)/g,
          (seg) => `/channel/${channel}/${seg}`
        );

        return new Response(playlist, {
          headers: { "Content-Type": "application/vnd.apple.mpegurl" },
        });
      }

      // --- Обработка сегмента ---
      if (path.includes(".tc")) {
        const parts = path.split("/");
        const channel = parts[2];
        const segment = parts.pop();

        if (!(channel in config)) {
          return new Response("Channel not found", { status: 404 });
        }

        const realUrl = new URL(config[channel]);
        realUrl.pathname = realUrl.pathname.replace(/[^/]+\.m3u8$/, segment);

        const segmentResp = await fetch(realUrl.toString(), {
          headers: {
            "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 8.0.1;)",
            "Referer": "https://peers.tv/",
          },
        });

        return new Response(segmentResp.body, {
          headers: { "Content-Type": "video/mp2t" },
        });
      }

      return new Response("Not found", { status: 404 });
    } catch (e) {
      return new Response("Error: " + e.message, { status: 500 });
    }
  },
};
