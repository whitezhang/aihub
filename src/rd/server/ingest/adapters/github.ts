import type { FrontierDraftItem } from "../types.ts";

const TRENDING_URL = "https://github.com/trending";

/**
 * Scrape https://github.com/trending (today, all languages).
 * Parses article.Box-row blocks from the HTML page.
 */
export async function fetchGithubHot(
  limit: number,
  _token?: string,
): Promise<FrontierDraftItem[]> {
  const res = await fetch(TRENDING_URL, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent":
        "Mozilla/5.0 (compatible; AiHub-Ingest/0.1; +https://localhost)",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub trending ${res.status}: ${text.slice(0, 200)}`);
  }
  const html = await res.text();
  const items = parseTrendingHtml(html).slice(0, limit);
  if (items.length === 0) {
    throw new Error("GitHub trending page parsed 0 repositories");
  }
  return items;
}

export function parseTrendingHtml(html: string): FrontierDraftItem[] {
  const articles = html.split(/<article\b[^>]*class="[^"]*Box-row[^"]*"/i);
  const out: FrontierDraftItem[] = [];

  for (let i = 1; i < articles.length; i++) {
    const block = articles[i] ?? "";
    const hrefMatch = block.match(
      /<h2[\s\S]*?<a[^>]+href="\/([^"/]+\/[^"/]+)"/i,
    );
    if (!hrefMatch?.[1]) continue;
    const externalId = hrefMatch[1].replace(/\s+/g, "");

    const descMatch = block.match(
      /<p[^>]*class="[^"]*col-9[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/p>/i,
    );
    const summary = cleanText(descMatch?.[1] ?? "") || "No description";

    const starsTodayMatch = block.match(
      /(\d[\d,]*)\s+stars?\s+today/i,
    );
    const totalStarsMatch = block.match(
      /href="\/[^"]+\/stargazers"[^>]*>\s*([\d,]+)/i,
    );
    const starsToday = parseCount(starsTodayMatch?.[1]);
    const totalStars = parseCount(totalStarsMatch?.[1]);
    const heatValue = starsToday > 0 ? starsToday : totalStars;

    const langMatch = block.match(
      /itemprop="programmingLanguage"[^>]*>\s*([^<]+)/i,
    );
    const tags = langMatch?.[1] ? [cleanText(langMatch[1])] : [];

    out.push({
      externalId,
      title: externalId,
      summary,
      url: `https://github.com/${externalId}`,
      heatKind: "star",
      heatValue,
      sourceTime: new Date().toISOString(),
      tags,
    });
  }

  return out;
}

function parseCount(raw: string | undefined): number {
  if (!raw) return 0;
  return Number(raw.replace(/,/g, "")) || 0;
}

function cleanText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
