import type { Db } from "../db/index.ts";
import type { Item, Sort, Source } from "../domain/types.ts";
import type { FrontierDraftItem, FrontierDayRow } from "./types.ts";
import { dayPlusDays } from "./time.ts";

export function getDay(
  db: Db,
  source: Source,
  day: string,
): FrontierDayRow | undefined {
  return db
    .prepare(
      `SELECT id, source, day, status, attempt_count, last_attempt_at, next_retry_at, error
       FROM frontier_days WHERE source = ? AND day = ?`,
    )
    .get(source, day) as FrontierDayRow | undefined;
}

export function ensureDay(db: Db, source: Source, day: string): FrontierDayRow {
  const existing = getDay(db, source, day);
  if (existing) return existing;
  db.prepare(
    `INSERT INTO frontier_days (source, day, status, attempt_count)
     VALUES (?, ?, 'pending', 0)`,
  ).run(source, day);
  return getDay(db, source, day)!;
}

export function markRunning(db: Db, dayId: number, atIso: string): void {
  db.prepare(
    `UPDATE frontier_days
     SET status = 'running',
         attempt_count = attempt_count + 1,
         last_attempt_at = ?,
         next_retry_at = NULL,
         error = NULL
     WHERE id = ?`,
  ).run(atIso, dayId);
}

export function markFailed(
  db: Db,
  dayId: number,
  error: string,
  nextRetryAt: string,
): void {
  db.prepare(
    `UPDATE frontier_days
     SET status = 'failed', error = ?, next_retry_at = ?
     WHERE id = ?`,
  ).run(error.slice(0, 500), nextRetryAt, dayId);
}

export function saveSuccessfulDay(
  db: Db,
  source: Source,
  dayId: number,
  drafts: FrontierDraftItem[],
  syncedAt: string,
): void {
  const delItems = db.prepare(`DELETE FROM frontier_day_items WHERE day_id = ?`);
  const insertDayItem = db.prepare(
    `INSERT INTO frontier_day_items
      (day_id, rank, external_id, title, summary, url, heat_kind, heat_value, source_time, tags_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const markOk = db.prepare(
    `UPDATE frontier_days
     SET status = 'success', error = NULL, next_retry_at = NULL
     WHERE id = ?`,
  );

  const clearProj = db.prepare(
    `DELETE FROM item_tags WHERE item_id IN (
       SELECT id FROM items WHERE category = 'frontier' AND source = ?
     )`,
  );
  const clearItems = db.prepare(
    `DELETE FROM items WHERE category = 'frontier' AND source = ?`,
  );
  const upsertItem = db.prepare(
    `INSERT INTO items
      (category, source, external_id, title, summary, url, heat_kind, heat_value, source_time, synced_at, status)
     VALUES ('frontier', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
  );
  const insertTag = db.prepare(
    `INSERT INTO item_tags (item_id, tag) VALUES (?, ?)`,
  );
  const idOf = db.prepare(
    `SELECT id FROM items WHERE category = 'frontier' AND source = ? AND external_id = ?`,
  );

  db.exec("BEGIN");
  try {
    delItems.run(dayId);
    drafts.forEach((d, i) => {
      insertDayItem.run(
        dayId,
        i + 1,
        d.externalId,
        d.title,
        d.summary,
        d.url,
        d.heatKind,
        d.heatValue,
        d.sourceTime,
        JSON.stringify(d.tags),
      );
    });
    markOk.run(dayId);

    clearProj.run(source);
    clearItems.run(source);
    for (const d of drafts) {
      upsertItem.run(
        source,
        d.externalId,
        d.title,
        d.summary,
        d.url,
        d.heatKind,
        d.heatValue,
        d.sourceTime,
        syncedAt,
      );
      const row = idOf.get(source, d.externalId) as { id: number };
      for (const tag of d.tags) {
        insertTag.run(row.id, tag);
      }
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function purgeOlderThan(
  db: Db,
  today: string,
  retentionDays: number,
): number {
  const cutoff = dayPlusDays(today, -retentionDays);
  const before = db
    .prepare(`SELECT COUNT(*) AS c FROM frontier_days WHERE day < ?`)
    .get(cutoff) as { c: number };
  db.prepare(`DELETE FROM frontier_days WHERE day < ?`).run(cutoff);
  return Number(before.c);
}

export function hasAnySuccess(db: Db, source: Source): boolean {
  const row = db
    .prepare(
      `SELECT 1 AS ok FROM frontier_days
       WHERE source = ? AND status = 'success' LIMIT 1`,
    )
    .get(source) as { ok: number } | undefined;
  return Boolean(row);
}

export function successDayId(
  db: Db,
  source: Source,
  day: string,
): { id: number; day: string } | undefined {
  return db
    .prepare(
      `SELECT id, day FROM frontier_days
       WHERE source = ? AND day = ? AND status = 'success'`,
    )
    .get(source, day) as { id: number; day: string } | undefined;
}

export function listSuccessDays(db: Db, source: Source): string[] {
  const rows = db
    .prepare(
      `SELECT day FROM frontier_days
       WHERE source = ? AND status = 'success'
       ORDER BY day DESC`,
    )
    .all(source) as { day: string }[];
  return rows.map((r) => r.day);
}

export function heatTrendForExternalIds(
  db: Db,
  source: Source,
  externalIds: string[],
  endDay: string,
  maxPoints = 14,
): Map<string, { day: string; value: number }[]> {
  const map = new Map<string, { day: string; value: number }[]>();
  if (externalIds.length === 0) return map;

  const placeholders = externalIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT i.external_id AS external_id, d.day AS day, i.heat_value AS heat_value
       FROM frontier_day_items i
       JOIN frontier_days d ON d.id = i.day_id
       WHERE d.source = ?
         AND d.status = 'success'
         AND d.day <= ?
         AND i.external_id IN (${placeholders})
       ORDER BY d.day ASC`,
    )
    .all(source, endDay, ...externalIds) as {
    external_id: string;
    day: string;
    heat_value: number;
  }[];

  for (const row of rows) {
    const list = map.get(row.external_id) ?? [];
    list.push({ day: row.day, value: Number(row.heat_value) });
    map.set(row.external_id, list);
  }

  for (const [key, list] of map) {
    map.set(key, list.slice(-maxPoints));
  }
  return map;
}

type DayItemRow = {
  id: number;
  external_id: string;
  title: string;
  summary: string;
  url: string;
  heat_kind: string;
  heat_value: number;
  source_time: string | null;
  tags_json: string;
  rank: number;
};

export type FrontierListResult = {
  items: Item[];
  page: number;
  pageSize: number;
  total: number;
  day: string | null;
  availableDays: string[];
};

export function listFrontier(
  db: Db,
  source: Source,
  sort: Sort,
  tag: string | undefined,
  page: number,
  pageSize: number,
  day?: string,
): FrontierListResult {
  const availableDays = listSuccessDays(db, source);
  if (availableDays.length === 0) {
    return {
      items: [],
      page,
      pageSize,
      total: 0,
      day: null,
      availableDays: [],
    };
  }

  const selectedDay = day && availableDays.includes(day) ? day : availableDays[0]!;
  const dayRow = successDayId(db, source, selectedDay);
  if (!dayRow) {
    return {
      items: [],
      page,
      pageSize,
      total: 0,
      day: selectedDay,
      availableDays,
    };
  }

  const all = db
    .prepare(
      `SELECT id, external_id, title, summary, url, heat_kind, heat_value, source_time, tags_json, rank
       FROM frontier_day_items WHERE day_id = ?`,
    )
    .all(dayRow.id) as DayItemRow[];

  let filtered = all.map((row) => {
    const tags = parseTags(row.tags_json);
    return { row, tags };
  });

  if (tag) {
    filtered = filtered.filter((x) => x.tags.includes(tag));
  }

  filtered.sort((a, b) => {
    if (sort === "latest") {
      const ta = a.row.source_time ?? "";
      const tb = b.row.source_time ?? "";
      if (ta !== tb) return ta < tb ? 1 : -1;
      return a.row.rank - b.row.rank;
    }
    const aHasHeat = a.row.heat_kind !== "none" && a.row.heat_value > 0;
    const bHasHeat = b.row.heat_kind !== "none" && b.row.heat_value > 0;
    if (aHasHeat && bHasHeat && b.row.heat_value !== a.row.heat_value) {
      return b.row.heat_value - a.row.heat_value;
    }
    if (aHasHeat !== bHasHeat) return aHasHeat ? -1 : 1;
    return a.row.rank - b.row.rank;
  });

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);
  const trends = heatTrendForExternalIds(
    db,
    source,
    slice.map((s) => s.row.external_id),
    selectedDay,
    14,
  );

  const items: Item[] = slice.map(({ row, tags }, index) => ({
    id: row.id,
    category: "frontier",
    source,
    externalId: row.external_id,
    title: row.title,
    summary: row.summary,
    url: row.url,
    heatKind: row.heat_kind as Item["heatKind"],
    heatValue: row.heat_value,
    sourceTime: row.source_time,
    syncedAt: selectedDay,
    tags,
    rank: start + index + 1,
    trend: trends.get(row.external_id) ?? [
      { day: selectedDay, value: row.heat_value },
    ],
  }));

  return {
    items,
    page,
    pageSize,
    total,
    day: selectedDay,
    availableDays,
  };
}

/** @deprecated use listFrontier */
export function listFrontierFromLatestSuccess(
  db: Db,
  source: Source,
  sort: Sort,
  tag: string | undefined,
  page: number,
  pageSize: number,
): FrontierListResult {
  return listFrontier(db, source, sort, tag, page, pageSize);
}

function parseTags(raw: string): string[] {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
