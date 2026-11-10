import type { RoutesResponse, SearchResult } from "../../src/types";

export async function searchPlaces(query: string, signal: AbortSignal): Promise<SearchResult[]> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
  const body = (await response.json()) as { results?: SearchResult[]; error?: string };
  if (!response.ok) throw new Error(body.error ?? "Place search failed.");
  return body.results ?? [];
}

export async function fetchRoutes(
  origin: SearchResult,
  destination: SearchResult,
  signal: AbortSignal,
): Promise<RoutesResponse> {
  const params = new URLSearchParams({
    originLat: String(origin.lat),
    originLon: String(origin.lon),
    destLat: String(destination.lat),
    destLon: String(destination.lon),
  });
  const timeout = AbortSignal.timeout(45_000);
  const response = await fetch(`/api/routes?${params}`, {
    signal: AbortSignal.any([signal, timeout]),
  });
  const body = (await response.json()) as RoutesResponse & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Could not plan that walk.");
  return body;
}
