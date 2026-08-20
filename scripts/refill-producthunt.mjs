/**
 * Re-fetch Product Hunt via GraphQL and replace today's snapshot.
 */
import { loadRuntimeConfig } from "../src/rd/server/db/config.ts";
import { migrate, openDb } from "../src/rd/server/db/index.ts";
import { fetchProductHuntHot } from "../src/rd/server/ingest/adapters/producthunt.ts";
import {
  ensureDay,
  saveSuccessfulDay,
} from "../src/rd/server/ingest/store.ts";
import { businessDay } from "../src/rd/server/ingest/time.ts";

const runtime = loadRuntimeConfig();
const db = openDb(runtime.dbPath);
migrate(db);

const day = businessDay(runtime.ingest.tz);
const row = ensureDay(db, "producthunt", day);
const drafts = await fetchProductHuntHot(runtime.ingest.limit, {
  token: runtime.ingest.productHuntToken,
  apiKey: runtime.ingest.productHuntApiKey,
  apiSecret: runtime.ingest.productHuntApiSecret,
});
saveSuccessfulDay(db, "producthunt", row.id, drafts, new Date().toISOString());

const sample = drafts[0];
process.stdout.write(
  `refilled producthunt ${day}: ${drafts.length} items; sample=${sample?.title} upvote=${sample?.heatValue}\n`,
);
db.close();
