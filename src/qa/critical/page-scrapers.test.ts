import { describe, expect, it } from "vitest";
import { parseTrendingHtml } from "../../rd/server/ingest/adapters/github.ts";

describe("page scrapers (critical)", () => {
  it("parses GitHub trending Box-row articles", () => {
    const html = `
      <article class="Box-row">
        <h2 class="h3 lh-condensed">
          <a href="/harry0703/MoneyPrinterTurbo">harry0703 / MoneyPrinterTurbo</a>
        </h2>
        <p class="col-9 color-fg-muted my-1 pr-4">
          Generate HD short videos with AI
        </p>
        <span itemprop="programmingLanguage">Python</span>
        <a href="/harry0703/MoneyPrinterTurbo/stargazers">112,068</a>
        <span>2,221 stars today</span>
      </article>
    `;
    const items = parseTrendingHtml(html);
    expect(items).toHaveLength(1);
    expect(items[0]?.externalId).toBe("harry0703/MoneyPrinterTurbo");
    expect(items[0]?.heatValue).toBe(2221);
  });
});
