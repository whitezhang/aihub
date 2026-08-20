export type Category = "prompt" | "mcp" | "skills" | "frontier";
export type Source = "github" | "producthunt";
export type Sort = "heat" | "latest";

export type TrendPoint = {
  day: string;
  value: number;
};

export type CatalogItem = {
  id: number;
  category: Category;
  source: Source;
  externalId?: string;
  title: string;
  summary: string;
  url: string;
  heatKind: "star" | "upvote" | "none";
  heatValue: number;
  sourceTime: string | null;
  syncedAt: string;
  tags: string[];
  rank?: number;
  trend?: TrendPoint[];
};

export type ItemsResponse = {
  items: CatalogItem[];
  page: number;
  pageSize: number;
  total: number;
  day?: string | null;
  availableDays?: string[];
};

export type FetchItemsParams = {
  category: Category;
  source?: Source;
  sort?: Sort;
  tag?: string;
  page?: number;
  pageSize?: number;
  day?: string;
};

export async function fetchItems(
  params: FetchItemsParams,
): Promise<ItemsResponse> {
  const qs = new URLSearchParams();
  qs.set("category", params.category);
  if (params.source) qs.set("source", params.source);
  qs.set("sort", params.sort ?? "heat");
  if (params.tag) qs.set("tag", params.tag);
  if (params.day) qs.set("day", params.day);
  qs.set("page", String(params.page ?? 1));
  qs.set("pageSize", String(params.pageSize ?? 20));

  const res = await fetch(`/api/items?${qs.toString()}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as ItemsResponse;
}
