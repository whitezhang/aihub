import type { HeatKind, Source } from "../domain/types.ts";

export type FrontierDraftItem = {
  externalId: string;
  title: string;
  summary: string;
  url: string;
  heatKind: HeatKind;
  heatValue: number;
  sourceTime: string | null;
  tags: string[];
};

export type FrontierDayRow = {
  id: number;
  source: Source;
  day: string;
  status: string;
  attempt_count: number;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  error: string | null;
};
