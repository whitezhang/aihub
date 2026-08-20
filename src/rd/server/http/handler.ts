import type { IncomingMessage, ServerResponse } from "node:http";
import type { Db } from "../db/index.ts";
import {
  isCategory,
  isSort,
  isSource,
  type Source,
} from "../domain/types.ts";
import { listItems } from "../services/items.ts";
import { sendDevLanding, tryServeStatic } from "./static.ts";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

export type HandlerOptions = {
  webDist?: string | null;
  port?: number;
};

function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sendError(
  res: ServerResponse,
  status: number,
  code: string,
  message: string,
): void {
  sendJson(res, status, { error: { code, message } } satisfies ApiErrorBody);
}

function readUrl(req: IncomingMessage): URL {
  return new URL(req.url ?? "/", "http://127.0.0.1");
}

export function createRequestHandler(db: Db, options: HandlerOptions = {}) {
  const webDist = options.webDist ?? null;
  const port = options.port ?? 8082;

  return (req: IncomingMessage, res: ServerResponse): void => {
    try {
      const url = readUrl(req);

      if (url.pathname.startsWith("/api/")) {
        if (req.method === "GET" && url.pathname === "/api/health") {
          sendJson(res, 200, { ok: true });
          return;
        }

        if (req.method === "GET" && url.pathname === "/api/items") {
          handleListItems(url, res, db);
          return;
        }

        sendError(res, 404, "not_found", "Not found");
        return;
      }

      if (tryServeStatic(webDist, req, res, url.pathname)) {
        return;
      }

      if (req.method === "GET" && url.pathname === "/") {
        sendDevLanding(res, port);
        return;
      }

      sendError(res, 404, "not_found", "Not found");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      sendError(res, 500, "internal_error", message);
    }
  };
}

function handleListItems(url: URL, res: ServerResponse, db: Db): void {
  const categoryRaw = url.searchParams.get("category") ?? "";
  if (!isCategory(categoryRaw)) {
    sendError(
      res,
      400,
      "invalid_category",
      "category must be one of prompt|mcp|skills|frontier",
    );
    return;
  }

  const sourceRaw = url.searchParams.get("source");
  let source: Source | undefined;
  if (sourceRaw) {
    if (!isSource(sourceRaw)) {
      sendError(
        res,
        400,
        "invalid_source",
        "source must be one of github|producthunt",
      );
      return;
    }
    source = sourceRaw;
  }

  if (categoryRaw === "frontier" && !source) {
    sendError(
      res,
      400,
      "source_required",
      "source is required when category=frontier",
    );
    return;
  }

  const sortRaw = url.searchParams.get("sort") ?? "heat";
  if (!isSort(sortRaw)) {
    sendError(res, 400, "invalid_sort", "sort must be heat|latest");
    return;
  }

  const tag = url.searchParams.get("tag") ?? undefined;
  const dayRaw = url.searchParams.get("day") ?? undefined;
  if (dayRaw && !/^\d{4}-\d{2}-\d{2}$/.test(dayRaw)) {
    sendError(res, 400, "invalid_day", "day must be YYYY-MM-DD");
    return;
  }
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSizeRaw = Number(url.searchParams.get("pageSize") ?? "20") || 20;
  const pageSize = Math.min(50, Math.max(1, pageSizeRaw));

  const result = listItems(db, {
    category: categoryRaw,
    source,
    sort: sortRaw,
    tag,
    page,
    pageSize,
    day: dayRaw,
  });

  sendJson(res, 200, result);
}
