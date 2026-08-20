import type { Db } from "../db/index.ts";
import type { Category, HeatKind, Item, Sort, Source } from "../domain/types.ts";
import { listFrontier } from "../ingest/store.ts";

export type ListItemsQuery = {
  category: Category;
  source?: Source;
  sort: Sort;
  tag?: string;
  page: number;
  pageSize: number;
  /** frontier only: YYYY-MM-DD */
  day?: string;
};

export type ListItemsResult = {
  items: Item[];
  page: number;
  pageSize: number;
  total: number;
  day?: string | null;
  availableDays?: string[];
};

type ItemRow = {
  id: number;
  category: string;
  source: string;
  external_id: string;
  title: string;
  summary: string;
  url: string;
  heat_kind: string;
  heat_value: number;
  source_time: string | null;
  synced_at: string;
};

function mapItem(row: ItemRow, tags: string[]): Item {
  return {
    id: row.id,
    category: row.category as Item["category"],
    source: row.source as Item["source"],
    externalId: row.external_id,
    title: row.title,
    summary: row.summary,
    url: row.url,
    heatKind: row.heat_kind as HeatKind,
    heatValue: row.heat_value,
    sourceTime: row.source_time,
    syncedAt: row.synced_at,
    tags,
  };
}

export function listItems(db: Db, query: ListItemsQuery): ListItemsResult {
  if (query.category === "frontier") {
    if (!query.source) {
      return {
        items: [],
        page: query.page,
        pageSize: query.pageSize,
        total: 0,
        day: null,
        availableDays: [],
      };
    }
    return listFrontier(
      db,
      query.source,
      query.sort,
      query.tag,
      query.page,
      query.pageSize,
      query.day,
    );
  }

  const where: string[] = ["status = 'active'", "category = ?"];
  const params: (string | number)[] = [query.category];

  if (query.source) {
    where.push("source = ?");
    params.push(query.source);
  }

  if (query.tag) {
    where.push("id IN (SELECT item_id FROM item_tags WHERE tag = ?)");
    params.push(query.tag);
  }

  const whereSql = where.join(" AND ");

  const totalRow = db
    .prepare(`SELECT COUNT(*) AS c FROM items WHERE ${whereSql}`)
    .get(...params) as { c: number };
  const total = Number(totalRow.c);

  const orderSql =
    query.sort === "latest"
      ? "ORDER BY COALESCE(source_time, synced_at) DESC, id DESC"
      : "ORDER BY heat_value DESC, id DESC";

  const offset = (query.page - 1) * query.pageSize;
  const rows = db
    .prepare(
      `SELECT id, category, source, external_id, title, summary, url,
              heat_kind, heat_value, source_time, synced_at
       FROM items
       WHERE ${whereSql}
       ${orderSql}
       LIMIT ? OFFSET ?`,
    )
    .all(...params, query.pageSize, offset) as ItemRow[];

  const tagStmt = db.prepare(
    "SELECT tag FROM item_tags WHERE item_id = ? ORDER BY tag ASC",
  );

  const items = rows.map((row) => {
    const tags = (tagStmt.all(row.id) as { tag: string }[]).map((t) => t.tag);
    return mapItem(row, tags);
  });

  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
  };
}
