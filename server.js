const http = require("http");

const PORT = process.env.PORT || 8080;

const PRIMARY_CONFIG_URL =
  "https://raw.githubusercontent.com/Timofey-91/iptv-proxy/refs/heads/main/config.json";

const BACKUP_CONFIG_URL =
  "https://raw.githubusercontent.com/Timofey-91/iptv-proxy-2/refs/heads/main/config.json";

const USER_AGENT =
  "Dalvik/2.1.0 (Linux; U; Android 8.0.1 tints)";

const REFERER = "https://peers.tv";

const CONFIG_CACHE_TIME = 5 * 60 * 1000;
const SOURCE_CACHE_TIME = 5 * 60 * 1000;


// ============================================================
// Кэш конфигураций
// ============================================================

let primaryConfig = null;
let primaryConfigExpiresAt = 0;

let backupConfig = null;
let backupConfigExpiresAt = 0;


// ============================================================
// Запоминаем последний рабочий источник
// ============================================================

let lastWorkingSource = null;
let sourceCacheExpiresAt = 0;


// ============================================================
// Загрузка config.json
// ============================================================

async function loadConfig(source) {
  const now = Date.now();

  if (source === "primary") {
    if (primaryConfig && now < primaryConfigExpiresAt) {
      return primaryConfig;
    }
  }

  if (source === "backup") {
    if (backupConfig && now < backupConfigExpiresAt) {
      return backupConfig;
    }
  }

  const configUrl =
    source === "primary"
      ? PRIMARY_CONFIG_URL
      : BACKUP_CONFIG_URL;

  console.log(`Loading ${source} config...`);

  const response = await fetch(configUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "application/json",
      "Cache-Control": "no-cache"
    }
  });

  if (!response.ok) {
    throw new Error(
      `${source} config HTTP ${response.status}`
    );
  }

  const config = await response.json();

  if (!config || typeof config !== "object") {
    throw new Error(
      `${source} config is invalid`
    );
  }

  if (source === "primary") {
    primaryConfig = config;
    primaryConfigExpiresAt = now + CONFIG_CACHE_TIME;
  } else {
    backupConfig = config;
    backupConfigExpiresAt = now + CONFIG_CACHE_TIME;
  }

  return config;
}


// ============================================================
// Получение URL канала из конкретного источника
// ============================================================

async function getTargetUrl(channel, source) {
  const config = await loadConfig(source);

  if (!(channel in config)) {
    throw new Error(
      `Channel "${channel}" not found in ${source} config`
    );
  }

  const targetUrl = config[channel];

  if (
    typeof targetUrl !== "string" ||
    !targetUrl.startsWith("http")
  ) {
    throw new Error(
      `Invalid URL for "${channel}" in ${source} config`
    );
  }

  return targetUrl;
}


// ============================================================
// Получаем URL с учётом последнего рабочего источника
// ============================================================

async function getCandidateSources() {
  const now = Date.now();

  const sources = [];

  // Если недавно работал конкретный источник,
  // пробуем его первым.
  if (
    lastWorkingSource &&
    now < sourceCacheExpiresAt
  ) {
    sources.push(lastWorkingSource);
  }

  // Затем primary
  if (!sources.includes("primary")) {
    sources.push("primary");
  }

  // Затем backup
  if (!sources.includes("backup")) {
    sources.push("backup");
  }

  return sources;
}


// ============================================================
// Получение M3U8 от Peers
// ============================================================

async function fetchPeers(targetUrl) {
  return fetch(targetUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      "Referer": REFERER,
      "Accept": "*/*"
    }
  });
}


// ============================================================
// Обработка M3U8
// ============================================================

function processM3U8(body, targetUrl) {

  // Убираем BYTEFOG
  body = body.replace(
    /^#BYTEFOG-INF.*\r?\n?/gm,
    ""
  );

  // Убираем tvc_plusN из путей
  body = body.replace(
    /\/tvc_plus\d+\//g,
    "/"
  );

  const baseUrl = new URL(targetUrl);

  const lines = body.split(/\r?\n/);

  return lines
    .map((line) => {

      const trimmed = line.trim();

      if (!trimmed) {
        return line;
      }

      // M3U8-комментарии
      if (trimmed.startsWith("#")) {
        return line;
      }

      // Уже абсолютный URL
      if (/^https?:\/\//i.test(trimmed)) {
        return line;
      }

      // Относительный URL -> абсолютный
      try {
        return new URL(
          trimmed,
          baseUrl
        ).toString();

      } catch {
        return line;
      }

    })
    .join("\n");
}


// ============================================================
// HTTP headers
// ============================================================

function responseHeaders(
  contentType = "application/vnd.apple.mpegurl"
) {
  return {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Cache-Control": "no-store"
  };
}


// ============================================================
// HTTP SERVER
// ============================================================

const server = http.createServer(
  async (request, response) => {

    try {

      // ------------------------------------------------------
      // CORS preflight
      // ------------------------------------------------------

      if (request.method === "OPTIONS") {

        response.writeHead(
          204,
          responseHeaders()
        );

        response.end();

        return;
      }


      // ------------------------------------------------------
      // Только GET / HEAD
      // ------------------------------------------------------

      if (
        request.method !== "GET" &&
        request.method !== "HEAD"
      ) {

        response.writeHead(
          405,
          responseHeaders(
            "text/plain; charset=utf-8"
          )
        );

        response.end(
          "Method Not Allowed"
        );

        return;
      }


      const requestUrl = new URL(
        request.url,
        `http://${request.headers.host || "localhost"}`
      );


      // ------------------------------------------------------
      // Health check для SnapDeploy
      // ------------------------------------------------------

      if (
        requestUrl.pathname === "/health" ||
        requestUrl.pathname === "/healthz" ||
        requestUrl.pathname === "/actuator/health" ||
        requestUrl.pathname === "/api/health"
      ) {

        response.writeHead(
          200,
          {
            "Content-Type":
              "application/json; charset=utf-8",

            "Cache-Control":
              "no-store"
          }
        );

        response.end(
          JSON.stringify({
            status: "ok"
          })
        );

        return;
      }


      let channel =
        requestUrl.pathname
          .replace(/^\/+/, "")
          .replace(/\.m3u8$/i, "");


      // ------------------------------------------------------
      // Главная
      // ------------------------------------------------------

      if (!channel) {

        response.writeHead(
          200,
          {
            "Content-Type":
              "text/plain; charset=utf-8",

            "Cache-Control":
              "no-store"
          }
        );

        response.end(
          "Peers IPTV proxy is working.\n\n" +
          "Available channels:\n" +
          "/tvc\n" +
          "/tvc_plus2\n" +
          "/tvc_plus4\n" +
          "/tvc_plus7\n"
        );

        return;
      }


      // ------------------------------------------------------
      // Получаем порядок источников
      // ------------------------------------------------------

      const sources =
        await getCandidateSources();


      let workingResponse = null;
      let workingSource = null;
      let workingTargetUrl = null;


      // ------------------------------------------------------
      // Перебираем primary / backup
      // ------------------------------------------------------

      for (const source of sources) {

        try {

          console.log(
            `Trying ${source} for ${channel}`
          );


          const targetUrl =
            await getTargetUrl(
              channel,
              source
            );


          const peersResponse =
            await fetchPeers(targetUrl);


          console.log(
            `${source}: Peers HTTP ${peersResponse.status}`
          );


          if (peersResponse.ok) {

            workingResponse =
              peersResponse;

            workingSource =
              source;

            workingTargetUrl =
              targetUrl;

            break;
          }


          console.log(
            `${source} failed with HTTP ${peersResponse.status}`
          );


        } catch (error) {

          console.log(
            `${source} error: ${error.message}`
          );
        }
      }


      // ------------------------------------------------------
      // Оба источника не сработали
      // ------------------------------------------------------

      if (!workingResponse) {

        response.writeHead(
          502,
          responseHeaders(
            "text/plain; charset=utf-8"
          )
        );

        response.end(
          "Both Peers config sources failed"
        );

        return;
      }


      // ------------------------------------------------------
      // Запоминаем рабочий источник на 5 минут
      // ------------------------------------------------------

      lastWorkingSource =
        workingSource;

      sourceCacheExpiresAt =
        Date.now() + SOURCE_CACHE_TIME;


      console.log(
        `Working source: ${workingSource}`
      );


      // ------------------------------------------------------
      // HEAD
      // ------------------------------------------------------

      if (request.method === "HEAD") {

        response.writeHead(
          200,
          responseHeaders(
            "application/vnd.apple.mpegurl"
          )
        );

        response.end();

        return;
      }


      // ------------------------------------------------------
      // Получаем M3U8
      // ------------------------------------------------------

      let body =
        await workingResponse.text();


      body =
        processM3U8(
          body,
          workingTargetUrl
        );


      // ------------------------------------------------------
      // Отдаём M3U8 Televizo
      // ------------------------------------------------------

      response.writeHead(
        200,
        responseHeaders(
          "application/vnd.apple.mpegurl"
        )
      );


      response.end(body);


    } catch (error) {

      console.error(
        "Proxy error:",
        error
      );


      response.writeHead(
        502,
        responseHeaders(
          "text/plain; charset=utf-8"
        )
      );


      response.end(
        `Proxy error: ${error.message}`
      );
    }
  }
);


// ============================================================
// START
// ============================================================

server.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `Peers IPTV proxy listening on port ${PORT}`
    );

  }
);
