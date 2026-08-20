export const CATEGORIES = ["prompt", "mcp", "skills", "frontier"] as const;
export type Category = (typeof CATEGORIES)[number];

export const SOURCES = ["github", "producthunt"] as const;
export type Source = (typeof SOURCES)[number];

export const SORTS = ["heat", "latest"] as const;
export type Sort = (typeof SORTS)[number];

export const HEAT_KINDS = ["star", "upvote", "none"] as const;
export type HeatKind = (typeof HEAT_KINDS)[number];

export type TrendPoint = {
  day: string;
  value: number;
};

export type Item = {
  id: number;
  category: Category;
  source: Source;
  externalId: string;
  title: string;
  summary: string;
  url: string;
  heatKind: HeatKind;
  heatValue: number;
  sourceTime: string | null;
  syncedAt: string;
  tags: string[];
  /** 1-based rank within the selected day list (frontier). */
  rank?: number;
  /** Daily heat history ending at selected day (frontier). */
  trend?: TrendPoint[];
};

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

export function isSource(value: string): value is Source {
  return (SOURCES as readonly string[]).includes(value);
}

export function isSort(value: string): value is Sort {
  return (SORTS as readonly string[]).includes(value);
}
