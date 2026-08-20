import type { Db } from "../db/index.ts";
import type { IngestConfig } from "../db/config.ts";
import type { Source } from "../domain/types.ts";
import { fetchGithubHot } from "./adapters/github.ts";
import { fetchProductHuntHot } from "./adapters/producthunt.ts";
import {
  ensureDay,
  getDay,
  hasAnySuccess,
  markFailed,
  markRunning,
  purgeOlderThan,
  saveSuccessfulDay,
} from "./store.ts";
import {
  addMinutesIso,
  businessDay,
  isPastDailyAt,
} from "./time.ts";
import type { FrontierDraftItem } from "./types.ts";

const SOURCES: Source[] = ["github", "producthunt"];

export type IngestRunner = {
  tick: () => Promise<void>;
  stop: () => void;
};

export function createIngestRunner(db: Db, config: IngestConfig): IngestRunner {
  let locked = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  async function runSource(source: Source): Promise<void> {
    const day = businessDay(config.tz);
    const row = ensureDay(db, source, day);
    if (row.status === "success") return;

    const now = new Date();
    // Cold start: no successful snapshot ever for this source → fetch now,
    // do not wait for INGEST_DAILY_AT. Also ignore leftover next_retry_at so a
    // restart after scraper fixes can refill an empty DB immediately.
    const coldStart = !hasAnySuccess(db, source);
    if (!coldStart && !isPastDailyAt(config.tz, config.dailyAt, now)) return;

    if (!coldStart && row.status === "failed" && row.next_retry_at) {
      if (Date.parse(row.next_retry_at) > now.getTime()) return;
    }

    // re-read after ensure
    const current = getDay(db, source, day)!;
    if (current.status === "running") {
      const started = current.last_attempt_at
        ? Date.parse(current.last_attempt_at)
        : 0;
      const staleMs = 15 * 60_000;
      if (started && Date.now() - started < staleMs) return;
    }

    const atIso = now.toISOString();
    markRunning(db, current.id, atIso);
    if (coldStart) {
      process.stdout.write(
        `[ingest] ${source} cold-start fetch (no prior success in db)\n`,
      );
    }

    try {
      const drafts = await fetchDrafts(source, config);
      if (drafts.length === 0) {
        throw new Error("adapter returned 0 items");
      }
      saveSuccessfulDay(db, source, current.id, drafts, atIso);
      purgeOlderThan(db, day, config.retentionDays);
      process.stdout.write(
        `[ingest] ${source} ${day} success (${drafts.length} items)\n`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const next = addMinutesIso(now, config.retryMinutes);
      markFailed(db, current.id, message, next);
      process.stdout.write(
        `[ingest] ${source} ${day} failed: ${message}; retry at ${next}\n`,
      );
    }
  }

  async function tick(): Promise<void> {
    if (!config.enabled || locked) return;
    locked = true;
    try {
      for (const source of SOURCES) {
        await runSource(source);
      }
    } finally {
      locked = false;
    }
  }

  function stop(): void {
    if (timer) clearInterval(timer);
    timer = null;
  }

  // kick off interval only when startInterval called from index
  return {
    tick,
    stop() {
      stop();
    },
  };
}

export function startIngestLoop(db: Db, config: IngestConfig): IngestRunner {
  const runner = createIngestRunner(db, config);
  if (!config.enabled) {
    process.stdout.write("[ingest] disabled (INGEST_ENABLED)\n");
    return runner;
  }
  void runner.tick();
  const timer = setInterval(() => {
    void runner.tick();
  }, config.tickMs);
  // attach stop to clear this timer
  return {
    tick: runner.tick,
    stop() {
      clearInterval(timer);
      runner.stop();
    },
  };
}

async function fetchDrafts(
  source: Source,
  config: IngestConfig,
): Promise<FrontierDraftItem[]> {
  if (source === "github") {
    return fetchGithubHot(config.limit, config.githubToken);
  }
  return fetchProductHuntHot(config.limit, {
    token: config.productHuntToken,
    apiKey: config.productHuntApiKey,
    apiSecret: config.productHuntApiSecret,
  });
}
