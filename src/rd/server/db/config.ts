import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type AppEnv = "local" | "production";

export type IngestConfig = {
  enabled: boolean;
  tz: string;
  dailyAt: string;
  retryMinutes: number;
  retentionDays: number;
  limit: number;
  githubToken: string | undefined;
  productHuntToken: string | undefined;
  productHuntApiKey: string | undefined;
  productHuntApiSecret: string | undefined;
  tickMs: number;
};

export type RuntimeConfig = {
  env: AppEnv;
  dbPath: string;
  port: number;
  ingest: IngestConfig;
};

function projectRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
}

function applyEnvFile(file: string): void {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

/**
 * Load env files into process.env (does not override existing).
 * Order:
 * 1. AIHUB_CONF (explicit path)
 * 2. src/op/conf/production.env when AIHUB_ENV=production already (e.g. systemd)
 * 3. otherwise src/op/conf/test.env (local npm start)
 */
export function loadDotEnv(_cwd = process.cwd()): void {
  const root = projectRoot();
  const confDir = path.join(root, "src/op/conf");
  if (process.env.AIHUB_CONF) {
    applyEnvFile(process.env.AIHUB_CONF);
  }
  if (process.env.AIHUB_ENV === "production") {
    applyEnvFile(path.join(confDir, "production.env"));
  } else {
    applyEnvFile(path.join(confDir, "test.env"));
  }
}

function parseEnv(raw: string | undefined): AppEnv {
  if (raw === "production") return "production";
  return "local";
}

function defaultDbPath(env: AppEnv): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  if (env === "production") {
    throw new Error(
      "AIHUB_ENV=production requires explicit DB_PATH (do not use local.sqlite)",
    );
  }
  return path.join(here, "local.sqlite");
}

/** Prevent local/prod sqlite files from being mixed accidentally. */
export function assertDbPathSafe(env: AppEnv, dbPath: string): void {
  const normalized = path.normalize(dbPath).replace(/\\/g, "/").toLowerCase();
  const base = path.basename(normalized);

  if (env === "production") {
    if (base === "local.sqlite" || normalized.includes("/server/db/local.sqlite")) {
      throw new Error(
        "Refusing to start: production must not use local.sqlite (set a dedicated DB_PATH)",
      );
    }
    return;
  }

  if (
    normalized.startsWith("/var/lib/aihub") ||
    normalized.includes("/var/lib/aihub/") ||
    normalized.includes("prod.sqlite")
  ) {
    throw new Error(
      "Refusing to start: local env points at a production-like DB_PATH",
    );
  }
}

export function loadRuntimeConfig(): RuntimeConfig {
  loadDotEnv();
  const env = parseEnv(process.env.AIHUB_ENV);
  const dbPath = process.env.DB_PATH ?? defaultDbPath(env);
  assertDbPathSafe(env, dbPath);

  const ingestEnabledRaw = process.env.INGEST_ENABLED;
  const enabled =
    ingestEnabledRaw === undefined
      ? true
      : ingestEnabledRaw === "1" || ingestEnabledRaw === "true";

  return {
    env,
    dbPath,
    port: Number(process.env.PORT ?? "8082"),
    ingest: {
      enabled,
      tz: process.env.INGEST_TZ ?? "Asia/Shanghai",
      dailyAt: process.env.INGEST_DAILY_AT ?? "08:00",
      retryMinutes: Number(process.env.INGEST_RETRY_MINUTES ?? "10") || 10,
      retentionDays: Number(process.env.INGEST_RETENTION_DAYS ?? "180") || 180,
      limit: Number(process.env.INGEST_LIMIT ?? "30") || 30,
      githubToken: process.env.GITHUB_TOKEN || undefined,
      productHuntToken: process.env.PRODUCTHUNT_API_TOKEN || undefined,
      productHuntApiKey: process.env.PRODUCTHUNT_API_KEY || undefined,
      productHuntApiSecret: process.env.PRODUCTHUNT_API_SECRET || undefined,
      tickMs: Number(process.env.INGEST_TICK_MS ?? "60000") || 60_000,
    },
  };
}
