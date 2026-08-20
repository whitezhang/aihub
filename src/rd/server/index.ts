import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadRuntimeConfig } from "./db/config.ts";
import { migrate, openDb } from "./db/index.ts";
import { createRequestHandler } from "./http/handler.ts";
import { startIngestLoop } from "./ingest/runner.ts";

const runtime = loadRuntimeConfig();
const db = openDb(runtime.dbPath);
migrate(db);

const defaultWebDist = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../output",
);
const webDistEnv = process.env.WEB_DIST;
const webDistCandidate = webDistEnv || defaultWebDist;
const webDist =
  webDistCandidate && fs.existsSync(path.join(webDistCandidate, "index.html"))
    ? webDistCandidate
    : null;

const server = http.createServer(
  createRequestHandler(db, { webDist, port: runtime.port }),
);

const ingest = startIngestLoop(db, runtime.ingest);

server.listen(runtime.port, "127.0.0.1", () => {
  process.stdout.write(
    `AiHub API listening on http://127.0.0.1:${runtime.port}\n`,
  );
  process.stdout.write(
    `env=${runtime.env} db=${runtime.dbPath} ingest=${runtime.ingest.enabled ? "on" : "off"}\n`,
  );
  if (webDist) {
    process.stdout.write(`Serving web from ${webDist}\n`);
  } else {
    process.stdout.write(
      `No web dist yet — open http://127.0.0.1:5172 after npm run dev:web\n`,
    );
  }
});

function shutdown(): void {
  ingest.stop();
  server.close();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
