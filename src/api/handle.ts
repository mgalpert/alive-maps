import { DEFAULT_USER_AGENT } from "../config";
import type { CacheStore } from "../poi/cache";
import { searchPlaces } from "../poi/nominatim";
import { PlanError, planWalk } from "../routing/plan";

export type ApiContext = {
  cache: CacheStore;
  userAgent?: string;
};

export async function handleApi(request: Request, ctx: ApiContext): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);

  try {
    if (url.pathname === "/api/health") return json({ ok: true });
    if (url.pathname === "/api/search") return await search(url, ctx);
    if (url.pathname === "/api/routes") return await routes(url, ctx);
    return json({ error: "Not found." }, 404);
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "api_crash",
        message: err instanceof Error ? err.message : String(err),
      }),
    );
    return json({ error: "Something went wrong planning that walk." }, 500);
  }
}

async function search(url: URL, ctx: ApiContext): Promise<Response> {
  const query = (url.searchParams.get("q") ?? "").trim().replace(/\s+/g, " ");
  if (query.length < 2) return json({ results: [] });
  if (query.length > 120) return json({ error: "That search is too long." }, 400);
  try {
    const results = await searchPlaces(query, {
      cache: ctx.cache,
      userAgent: ctx.userAgent || DEFAULT_USER_AGENT,
    });
    return json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Place search failed.";
    return json({ error: message }, 502);
  }
}

async function routes(url: URL, ctx: ApiContext): Promise<Response> {
  const originLat = numberParam(url, "originLat");
  const originLon = numberParam(url, "originLon");
  const destLat = numberParam(url, "destLat");
  const destLon = numberParam(url, "destLon");
  if (
    originLat === null ||
    originLon === null ||
    destLat === null ||
    destLon === null ||
    !inRange(originLat, -90, 90) ||
    !inRange(destLat, -90, 90) ||
    !inRange(originLon, -180, 180) ||
    !inRange(destLon, -180, 180)
  ) {
    return json({ error: "Origin and destination need valid coordinates." }, 400);
  }
  try {
    const body = await planWalk({
      origin: { lat: originLat, lon: originLon },
      destination: { lat: destLat, lon: destLon },
      cache: ctx.cache,
      userAgent: ctx.userAgent || DEFAULT_USER_AGENT,
    });
    return json(body);
  } catch (err) {
    if (err instanceof PlanError) return json({ error: err.message }, err.status);
    throw err;
  }
}

function numberParam(url: URL, key: string): number | null {
  const value = Number(url.searchParams.get(key));
  return Number.isFinite(value) ? value : null;
}

function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": status === 200 ? "public, max-age=60" : "no-store",
      ...corsHeaders(),
    },
  });
}

function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}
