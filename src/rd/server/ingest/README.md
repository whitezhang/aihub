# Ingest (frontier sync)

Design: `docs/ingest-frontier-design.md`

- Daily capture per source (`github`, `producthunt`)
- On failure: retry every 10 minutes until that business day succeeds
- Snapshots retained 180 days (`frontier_days` / `frontier_day_items`)
- Local vs production: separate `DB_PATH` + `AIHUB_ENV` guards

Enable/disable: `INGEST_ENABLED=0|1`
