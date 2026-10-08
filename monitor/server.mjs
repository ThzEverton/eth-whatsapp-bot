import http from "node:http";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { openSync, closeSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import "dotenv/config";
import { extensionPackage } from "./extension-package.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const stateFile = path.join(root, "monitor", "state.json");
let pid = Number(process.env.BOT_MONITOR_PID || 0);
let restarts = 0;
let lastRestart = 0;
let supervisorError = "";
let paused = false;
let controlling = false;
try {
  const saved = JSON.parse(await readFile(stateFile, "utf8"));
  pid = saved.pid;
  restarts = saved.restarts || 0;
} catch {}
try {
  const info = JSON.parse(
    await readFile(path.join(root, "runtime", "panel.json"), "utf8"),
  );
  if (Number.isSafeInteger(info.pid) && info.pid > 0) pid = info.pid;
} catch {}
const alive = () => {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
async function logLines(file) {
  try {
    const { open } = await import("node:fs/promises");
    const handle = await open(path.join(root, file), "r");
    try {
      const info = await handle.stat();
      const offset = Math.max(0, info.size - 131072);
      const buffer = Buffer.alloc(info.size - offset);
      await handle.read(buffer, 0, buffer.length, offset);
      const lines = buffer.toString("utf8").split(/\r?\n/);
      if (offset) lines.shift();
      return lines.filter(Boolean);
    } finally {
      await handle.close();
    }
  } catch {
    return [];
  }
}
async function status() {
  const lines = await logLines("bot-output.log");
  const events = lines.flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
  const current = events.filter((e) => e.pid === pid);
  const connection = current
    .filter((e) =>
      /WhatsApp conectado|WhatsApp desconectado|Não foi possível iniciar/.test(
        e.msg || "",
      ),
    )
    .at(-1);
  let allowed = (process.env.ALLOWED_GROUP_IDS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  try {
    allowed = JSON.parse(
      await readFile(
        path.resolve(root, process.env.CONFIG_FILE || "./runtime/config.json"),
        "utf8",
      ),
    ).groups;
  } catch {}
  const groups = [
    ...new Map(
      current
        .filter((e) => e.groupId)
        .map((e) => [
          e.groupId,
          {
            id: e.groupId,
            name: e.groupName || "Grupo sem nome",
            allowed: allowed.includes(e.groupId),
          },
        ]),
    ).values(),
  ];
  for (const id of allowed)
    if (!groups.some((g) => g.id === id))
      groups.push({ id, name: "Grupo autorizado", allowed: true });
  const running = alive();
  return {
    running,
    pid,
    restarts,
    supervisorError,
    connection: !running
      ? "offline"
      : connection?.msg === "WhatsApp conectado"
        ? "connected"
        : connection
          ? "disconnected"
          : "unknown",
    connectedAt:
      connection?.msg === "WhatsApp conectado" ? connection.time : null,
    now: Date.now(),
    groups,
    events: current.slice(-70).map((e) => ({
      time: e.time,
      level: e.level,
      text: e.msg || "Evento",
      group: e.groupName,
      groupId: e.groupId,
      code: e.code,
    })),
    errors: (await logLines("bot-error.log")).slice(-8),
    limitations: "Mensagens e partidas não são registradas pela sessão atual.",
  };
}
async function supervise() {
  if (paused) return;
  if (alive() || Date.now() - lastRestart < 30000) return;
  const events = (await logLines("bot-output.log"))
    .flatMap((x) => {
      try {
        return [JSON.parse(x)];
      } catch {
        return [];
      }
    })
    .filter((e) => e.pid === pid);
  if (events.some((e) => [401, 403, 411, 440, 500].includes(e.code))) {
    supervisorError =
      "Sessão exige intervenção. Reconexão automática suspensa para preservar credenciais.";
    return;
  }
  lastRestart = Date.now();
  const out = openSync(path.join(root, "bot-output.log"), "a");
  const err = openSync(path.join(root, "bot-error.log"), "a");
  try {
    const child = spawn(process.execPath, ["dist/index.js"], {
      cwd: root,
      detached: true,
      windowsHide: true,
      stdio: ["ignore", out, err],
    });
    child.on("error", (e) => {
      supervisorError = e.message;
    });
    if (child.pid) {
      pid = child.pid;
      restarts++;
      child.unref();
      await writeFile(stateFile, JSON.stringify({ pid, restarts }));
    }
  } finally {
    closeSync(out);
    closeSync(err);
  }
}
async function readPage() {
  // Inline the critical assets so the Chrome side panel cannot show an
  // unstyled page if an old extension/webview cached missing asset responses.
  let html = await readFile(new URL("./index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("./ui.css", import.meta.url), "utf8");
  html = html.replace('<link rel="stylesheet" href="/ui.css">', '<style>' + css + '</style>');
  let scripts = "";
  for (const file of ["monitor-ui.js", "management.js"]) {
    const js = await readFile(new URL("./" + file, import.meta.url), "utf8");
    html = html.replace('<script defer src="/' + file + '"></script>', '');
    scripts += '<script>\n' + js + '\n</script>\n';
  }
  // Inline scripts ignore the defer attribute. They must execute after the DOM.
  return html.replace("</body>", scripts + "</body>");
}
async function bridge(route, method = "GET", body) {
  const info = JSON.parse(
    await readFile(path.join(root, "runtime", "panel.json"), "utf8"),
  );
  if (info.pid !== pid || !alive())
    throw Error("Bot indisponível. Aguarde a conexão.");
  return fetch(`http://127.0.0.1:${info.port}/${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${info.token}`,
      "Content-Type": "application/json",
    },
    body,
    signal: AbortSignal.timeout(20000),
  });
}
const server = http.createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'self' chrome-extension:",
  );
  if (!["localhost:3100", "127.0.0.1:3100"].includes(req.headers.host)) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (
    req.url === "/api/panel" ||
    req.url === "/api/action" ||
    req.url === "/api/bot"
  ) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    try {
      const mutation = req.url !== "/api/panel";
      if (req.method !== (mutation ? "POST" : "GET")) {
        res.writeHead(405);
        res.end();
        return;
      }
      if (
        mutation &&
        (!["http://localhost:3100", "http://127.0.0.1:3100"].includes(
          req.headers.origin,
        ) ||
          !req.headers["content-type"]?.startsWith("application/json"))
      ) {
        res.writeHead(403);
        res.end('{"error":"Origem inválida"}');
        return;
      }
      let body = "";
      if (mutation)
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 20000)
            throw Error("Solicitação muito grande");
        }
      if (req.url === "/api/bot") {
        if (controlling) throw Error("Outra operação está em andamento");
        const { action } = JSON.parse(body);
        if (!["start", "stop", "restart"].includes(action))
          throw Error("Ação inválida");
        controlling = true;
        try {
          if (action !== "start" && alive()) {
            const check = await bridge("state");
            if (!check.ok || (await check.json()).pid !== pid)
              throw Error("Não foi possível verificar o processo do bot");
            paused = true;
            process.kill(pid, "SIGTERM");
            for (let attempt = 0; attempt < 50 && alive(); attempt++)
              await new Promise((resolve) => setTimeout(resolve, 100));
            if (alive())
              throw Error("O bot ainda está encerrando. Tente novamente.");
          }
          if (action === "stop") paused = true;
          else {
            paused = false;
            supervisorError = "";
            lastRestart = 0;
            await supervise();
          }
          res.end(JSON.stringify({ ok: true }));
        } finally {
          controlling = false;
        }
        return;
      }
      const response = await bridge(
        mutation ? "action" : "state",
        req.method,
        mutation ? body : undefined,
      );
      res.writeHead(response.status);
      res.end(await response.text());
    } catch (e) {
      res.writeHead(503);
      res.end(JSON.stringify({ error: e.message || "Bot indisponível" }));
    }
    return;
  }
  if (req.method !== "GET") {
    res.writeHead(405);
    res.end();
    return;
  }
  if (req.url === "/api/status") {
    try {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(await status()));
    } catch {
      res.writeHead(500);
      res.end('{"error":"Falha ao ler monitoramento"}');
    }
  } else if (req.url === "/extension.zip") {
    try {
      const zip = await extensionPackage();
      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="eth-whatsapp-extension.zip"',
      );
      res.end(zip);
    } catch {
      res.writeHead(500);
      res.end("Não foi possível preparar a extensão. Tente novamente.");
    }
  } else if (["/ui.css", "/monitor-ui.js", "/legal-documents.json"].includes(req.url)) {
    const type = req.url.endsWith(".css") ? "text/css" : req.url.endsWith(".json") ? "application/json" : "text/javascript";
    res.setHeader("Content-Type", type + "; charset=utf-8");
    res.end(await readFile(new URL("." + req.url, import.meta.url)));
  } else if (/^\/assets\/(inter-latin-(400|500|600|700)-normal\.woff2|lucide\.min\.js)$/.test(req.url)) {
    res.setHeader("Content-Type", req.url.endsWith(".woff2") ? "font/woff2" : "text/javascript; charset=utf-8");
    res.end(await readFile(new URL("." + req.url, import.meta.url)));
  } else if (req.url === "/management.js") {
    res.setHeader("Content-Type", "text/javascript; charset=utf-8");
    res.end(await readFile(new URL("./management.js", import.meta.url)));
  } else if (req.url === "/sidebar") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end((await readPage()).replace("<body>", '<body class="compact">'));
  } else if (req.url === "/" || req.url === "/index.html") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(await readPage());
  } else {
    res.writeHead(404);
    res.end();
  }
});
server.listen(3100, "127.0.0.1", async () => {
  await mkdir(path.dirname(stateFile), { recursive: true });
  await writeFile(stateFile, JSON.stringify({ pid, restarts }));
  await supervise();
  console.log("Monitor: http://localhost:3100");
  setInterval(
    () =>
      supervise().catch((e) => {
        supervisorError = e.message;
      }),
    5000,
  );
});
