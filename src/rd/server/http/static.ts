import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function safeJoin(root: string, urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath.split("?")[0] ?? "/");
  const rel = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const full = path.normalize(path.join(root, rel));
  const rootFull = path.normalize(root + path.sep);
  if (full !== path.normalize(root) && !full.startsWith(rootFull)) {
    return null;
  }
  return full;
}

export function tryServeStatic(
  webDist: string | null,
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): boolean {
  if (!webDist || (req.method !== "GET" && req.method !== "HEAD")) {
    return false;
  }

  let filePath = safeJoin(webDist, pathname);
  if (!filePath) {
    res.writeHead(400).end("Bad path");
    return true;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // SPA fallback
    filePath = path.join(webDist, "index.html");
    if (!fs.existsSync(filePath)) return false;
  }

  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] ?? "application/octet-stream";
  const body = fs.readFileSync(filePath);
  res.writeHead(200, {
    "Content-Type": type,
    "Content-Length": body.byteLength,
  });
  if (req.method !== "HEAD") res.write(body);
  res.end();
  return true;
}

export function sendDevLanding(res: ServerResponse, apiPort: number): void {
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AiHub API</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.6; color: #1f2937; }
    code { background: #f3f4f6; padding: 0.1rem 0.35rem; border-radius: 4px; }
    a { color: #1d4ed8; }
  </style>
</head>
<body>
  <h1>AiHub API (:${apiPort})</h1>
  <p>这里是 <strong>后端 API</strong>，不是前端页面。</p>
  <ul>
    <li>本地看网站：先开 <code>npm run dev:web</code>，访问
      <a href="http://127.0.0.1:5172/">http://127.0.0.1:5172/</a>
    </li>
    <li>或先 <code>npm run build</code> 再 <code>npm start</code>，本端口会托管仓根 <code>output/</code></li>
    <li>健康检查：<a href="/api/health"><code>/api/health</code></a></li>
  </ul>
</body>
</html>`;
  const body = Buffer.from(html, "utf8");
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": body.byteLength,
  });
  res.end(body);
}
