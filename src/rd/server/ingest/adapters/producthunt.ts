import type { FrontierDraftItem } from "../types.ts";

const PH_GRAPHQL = "https://api.producthunt.com/v2/api/graphql";
const PH_TOKEN_URL = "https://api.producthunt.com/v2/oauth/token";

export type ProductHuntAuth = {
  /** Developer / bearer token (optional if key+secret provided). */
  token?: string;
  apiKey?: string;
  apiSecret?: string;
};

let cachedAccessToken: { token: string; fetchedAt: number } | null = null;

/**
 * Product Hunt 热点：只用官方 GraphQL（真实 votesCount）。
 * 认证：PRODUCTHUNT_API_TOKEN，或 API Key + Secret 换 client_credentials token。
 */
export async function fetchProductHuntHot(
  limit: number,
  auth: ProductHuntAuth = {},
): Promise<FrontierDraftItem[]> {
  const accessToken = await resolveAccessToken(auth);
  return fetchViaGraphql(limit, accessToken);
}

async function resolveAccessToken(auth: ProductHuntAuth): Promise<string> {
  if (auth.token?.trim()) return auth.token.trim();

  if (auth.apiKey?.trim() && auth.apiSecret?.trim()) {
    if (
      cachedAccessToken &&
      Date.now() - cachedAccessToken.fetchedAt < 50 * 60_000
    ) {
      return cachedAccessToken.token;
    }
    const token = await fetchClientCredentialsToken(
      auth.apiKey.trim(),
      auth.apiSecret.trim(),
    );
    cachedAccessToken = { token, fetchedAt: Date.now() };
    return token;
  }

  throw new Error(
    "Product Hunt GraphQL requires PRODUCTHUNT_API_TOKEN or PRODUCTHUNT_API_KEY + PRODUCTHUNT_API_SECRET",
  );
}

async function fetchClientCredentialsToken(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const res = await fetch(PH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "AiHub-Ingest/0.1",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !body.access_token) {
    throw new Error(
      `Product Hunt token ${res.status}: ${body.error_description || body.error || "no access_token"}`,
    );
  }
  return body.access_token;
}

async function fetchViaGraphql(
  limit: number,
  token: string,
): Promise<FrontierDraftItem[]> {
  // Featured/hot-style: recent posts ordered by votes (real upvote counts).
  const query = `
    query HotPosts($first: Int!) {
      posts(first: $first, order: VOTES) {
        edges {
          node {
            id
            name
            tagline
            url
            votesCount
            createdAt
            topics(first: 5) {
              edges { node { name } }
            }
          }
        }
      }
    }
  `;

  const res = await fetch(PH_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "AiHub-Ingest/0.1",
    },
    body: JSON.stringify({ query, variables: { first: limit } }),
  });

  const body = (await res.json()) as {
    data?: {
      posts?: {
        edges?: {
          node?: {
            id?: string;
            name?: string;
            tagline?: string | null;
            url?: string;
            votesCount?: number;
            createdAt?: string;
            topics?: { edges?: { node?: { name?: string } }[] };
          };
        }[];
      };
    };
    errors?: { message?: string }[];
  };

  if (!res.ok) {
    throw new Error(`Product Hunt GraphQL HTTP ${res.status}`);
  }
  if (body.errors?.length) {
    throw new Error(
      `Product Hunt GraphQL: ${body.errors.map((e) => e.message).join("; ")}`,
    );
  }

  const posts =
    body.data?.posts?.edges?.map((e) => e.node).filter(Boolean) ?? [];
  if (posts.length === 0) {
    throw new Error("Product Hunt GraphQL returned 0 posts");
  }

  return posts.slice(0, limit).map((p) => {
    const tags =
      p!.topics?.edges
        ?.map((e) => e.node?.name)
        .filter((n): n is string => Boolean(n)) ?? [];
    return {
      externalId: String(p!.id ?? p!.url ?? p!.name),
      title: p!.name ?? "untitled",
      summary: (p!.tagline ?? "").trim(),
      url: p!.url ?? "https://www.producthunt.com/",
      heatKind: "upvote" as const,
      heatValue: Number(p!.votesCount ?? 0),
      sourceTime: p!.createdAt ?? null,
      tags: tags.slice(0, 8),
    };
  });
}
