import { openDb, migrate, defaultDbPath } from "../src/rd/server/db/index.ts";

const db = openDb(defaultDbPath());
migrate(db);

const days = db
  .prepare(
    "SELECT id, source, day, status, error, attempt_count, next_retry_at FROM frontier_days ORDER BY id DESC LIMIT 20",
  )
  .all();
console.log("days", days);

const itemCount = db
  .prepare("SELECT COUNT(*) AS c FROM frontier_day_items")
  .get();
console.log("day_items", itemCount);

const proj = db
  .prepare(
    "SELECT source, COUNT(*) AS c FROM items WHERE category = 'frontier' GROUP BY source",
  )
  .all();
console.log("proj", proj);

db.close();
