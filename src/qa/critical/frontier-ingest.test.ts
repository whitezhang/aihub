import http from "node:http";
import type { AddressInfo } from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertDbPathSafe } from "../../rd/server/db/config.ts";
import { migrate, openDb } from "../../rd/server/db/index.ts";
import { createRequestHandler } from "../../rd/server/http/handler.ts";
import type { Db } from "../../rd/server/db/index.ts";
import {
  ensureDay,
  hasAnySuccess,
  purgeOlderThan,
  saveSuccessfulDay,
} from "../../rd/server/ingest/store.ts";

describe("frontier history + isolation (critical)", () => {
  let db: Db;
  let dbPath: string;
  let baseUrl: string;
  let server: http.Server;

  beforeAll(async () => {
    dbPath = path.join(
      os.tmpdir(),
      `aihub-frontier-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`,
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

  it("refuses production local.sqlite and local prod-like paths", () => {
    expect(() =>
      assertDbPathSafe("production", "D:/workspace/codes/aihub/src/rd/server/db/local.sqlite"),
    ).toThrow(/local\.sqlite/);
    expect(() =>
      assertDbPathSafe("local", "/var/lib/aihub/prod.sqlite"),
    ).toThrow(/production-like/);
  });

  it("serves frontier list from latest success snapshot", async () => {
    const day = ensureDay(db, "github", "2026-08-20");
    saveSuccessfulDay(
      db,
      "github",
      day.id,
      [
        {
          externalId: "owner/demo",
          title: "owner/demo",
          summary: "demo repo",
          url: "https://github.com/owner/demo",
          heatKind: "star",
          heatValue: 42,
          sourceTime: "2026-08-19T00:00:00.000Z",
          tags: ["llm"],
        },
      ],
      new Date().toISOString(),
    );

    const res = await fetch(
      `${baseUrl}/api/items?category=frontier&source=github&sort=heat`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.day).toBe("2026-08-20");
    expect(body.availableDays).toContain("2026-08-20");
    expect(body.items[0].title).toBe("owner/demo");
    expect(body.items[0].heatKind).toBe("star");
    expect(body.items[0].rank).toBe(1);
    expect(body.items[0].trend?.length).toBeGreaterThanOrEqual(1);
    expect(body.items[0].tags).toContain("llm");
  });

  it("filters frontier by day query", async () => {
    const d1 = ensureDay(db, "github", "2026-08-18");
    saveSuccessfulDay(
      db,
      "github",
      d1.id,
      [
        {
          externalId: "owner/old",
          title: "owner/old",
          summary: "old",
          url: "https://github.com/owner/old",
          heatKind: "star",
          heatValue: 10,
          sourceTime: null,
          tags: [],
        },
      ],
      new Date().toISOString(),
    );
    const res = await fetch(
      `${baseUrl}/api/items?category=frontier&source=github&day=2026-08-18`,
    );
    const body = await res.json();
    expect(body.day).toBe("2026-08-18");
    expect(body.items[0].title).toBe("owner/old");
  });

  it("keeps requested day when source has no snapshot that day", async () => {
    const res = await fetch(
      `${baseUrl}/api/items?category=frontier&source=producthunt&day=2026-08-21`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.day).toBe("2026-08-21");
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
    // Must not silently jump to another source-success day (e.g. 2026-08-20).
    expect(body.day).not.toBe("2026-08-20");
  });

  it("treats missing success as cold-start eligible", () => {
    expect(hasAnySuccess(db, "producthunt")).toBe(false);
    const day = ensureDay(db, "producthunt", "2026-08-20");
    expect(day.status).toBe("pending");
    // after a success, not cold
    saveSuccessfulDay(
      db,
      "producthunt",
      day.id,
      [
        {
          externalId: "ph-1",
          title: "App",
          summary: "tagline",
          url: "https://www.producthunt.com/posts/app",
          heatKind: "upvote",
          heatValue: 10,
          sourceTime: null,
          tags: [],
        },
      ],
      new Date().toISOString(),
    );
    expect(hasAnySuccess(db, "producthunt")).toBe(true);
  });

  it("purges snapshots older than retention window", () => {
    const oldDay = ensureDay(db, "github", "2025-01-01");
    saveSuccessfulDay(
      db,
      "github",
      oldDay.id,
      [
        {
          externalId: "old/repo",
          title: "old/repo",
          summary: "old",
          url: "https://github.com/old/repo",
          heatKind: "star",
          heatValue: 1,
          sourceTime: null,
          tags: [],
        },
      ],
      new Date().toISOString(),
    );
    const today = "2026-08-20";
    const removed = purgeOlderThan(db, today, 180);
    expect(removed).toBeGreaterThanOrEqual(1);
    const row = db
      .prepare(`SELECT COUNT(*) AS c FROM frontier_days WHERE day = '2025-01-01'`)
      .get() as { c: number };
    expect(Number(row.c)).toBe(0);
  });
});
