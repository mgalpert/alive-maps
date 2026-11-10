import { fetchExternal } from "../http";
import type { SearchResult } from "../types";
import { cachedJson, type CacheStore } from "./cache";

type NominatimItem = {
  lat?: string;
  lon?: string;
  display_name?: string;
};

export async function searchPlaces(
  query: string,
  ctx: { cache: CacheStore; userAgent: string },
): Promise<SearchResult[]> {
  const key = `nominatim:v1:${query.toLowerCase()}`;
  return cachedJson(ctx.cache, key, 24 * 60 * 60, () => loadPlaces(query, ctx.userAgent));
}

async function loadPlaces(query: string, userAgent: string): Promise<SearchResult[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "6");
  url.searchParams.set("addressdetails", "0");
  const response = await fetchExternal(url.toString(), {
    timeoutMs: 8_000,
    userAgent,
  });
  const text = await response.text();
  if (response.status === 429) {
    throw new Error("Place search is busy. Try again in a few seconds.");
  }
  if (!response.ok) throw new Error("Place search failed.");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error("Place search returned an unexpected response.");
  }
  if (!Array.isArray(body)) return [];
  const results: SearchResult[] = [];
  for (const item of body as NominatimItem[]) {
    const lat = Number(item.lat);
    const lon = Number(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !item.display_name) continue;
    results.push({ label: shortenLabel(item.display_name), lat, lon });
  }
  return results;
}

function shortenLabel(displayName: string): string {
  const parts = displayName
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.slice(0, 3).join(", ");
}
