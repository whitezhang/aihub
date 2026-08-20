import http from "node:http";
import type { AddressInfo } from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate, openDb } from "../../rd/server/db/index.ts";
import { createRequestHandler } from "../../rd/server/http/handler.ts";
import type { Db } from "../../rd/server/db/index.ts";

describe("GET /api/items (critical)", () => {
  let db: Db;
  let dbPath: string;
  let baseUrl: string;
  let server: http.Server;

  beforeAll(async () => {
    dbPath = path.join(
      os.tmpdir(),
      `aihub-critical-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`,
    );
    db = openDb(dbPath);
    migrate(db);
    server = http.createServer(createRequestHandler(db));
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    db.close();
    fs.rmSync(dbPath, { force: true });
  });

  it("returns empty list for category pages", async () => {
    const res = await fetch(`${baseUrl}/api/items?category=prompt`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
    });
  });

  it("requires source for frontier", async () => {
    const res = await fetch(`${baseUrl}/api/items?category=frontier`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("source_required");
  });

  it("returns empty frontier github partition", async () => {
    const res = await fetch(
      `${baseUrl}/api/items?category=frontier&source=github&sort=heat`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("rejects invalid category", async () => {
    const res = await fetch(`${baseUrl}/api/items?category=news`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_category");
  });
});
