import { fetchExternal } from "../http";
import type { LatLng } from "../types";
import { cachedJson, type CacheStore } from "../poi/cache";

// The public OSRM demo's foot profile is about 20 km/h, so it is only a
// fallback. FOSSGIS serves a real walking speed.
const PROVIDERS = [
  "https://routing.openstreetmap.de/routed-foot",
  "https://router.project-osrm.org",
];

type OsrmBody = {
  code?: string;
  routes?: {
    duration?: number;
    distance?: number;
    geometry?: { coordinates?: [number, number][] };
  }[];
};

export type OsrmRoute = {
  durationSec: number;
  distanceM: number;
  geometry: [number, number][];
};

export async function osrmFoot(
  points: LatLng[],
  options: { alternatives: boolean; cache: CacheStore; userAgent: string },
): Promise<OsrmRoute[]> {
  const path = points.map((point) => `${point.lon.toFixed(5)},${point.lat.toFixed(5)}`).join(";");
  const key = `osrm:v1:${options.alternatives ? "alt" : "one"}:${path}`;
  return cachedJson(options.cache, key, 30 * 60, () => loadRoutes(path, options));
}

/** True when duration and distance look like walking, not a fast bike profile. */
export function isWalkingPace(distanceM: number, durationSec: number): boolean {
  if (durationSec <= 0 || distanceM <= 0) return false;
  const kmh = distanceM / 1000 / (durationSec / 3600);
  return kmh >= 2 && kmh <= 9;
}

async function loadRoutes(
  path: string,
  options: { alternatives: boolean; userAgent: string },
): Promise<OsrmRoute[]> {
  let lastError = "Routing failed";
  let fallback: OsrmRoute[] | null = null;
  let fallbackKmh = Infinity;
  for (const base of PROVIDERS) {
    const url =
      `${base}/route/v1/foot/${path}` +
      `?overview=full&geometries=geojson&steps=false&alternatives=${options.alternatives ? "true" : "false"}`;
    try {
      const response = await fetchExternal(url, { timeoutMs: 8_000, userAgent: options.userAgent });
      const text = await response.text();
      if (!response.ok) {
        lastError = `Routing ${response.status}`;
        continue;
      }
      const body = JSON.parse(text) as OsrmBody;
      if (body.code !== "Ok" || !body.routes?.length) {
        lastError = body.code === "NoRoute" ? "NoRoute" : (body.code ?? "Routing failed");
        continue;
      }
      const routes = body.routes
        .map(toRoute)
        .filter((route): route is OsrmRoute => route !== null)
        .sort((a, b) => a.durationSec - b.durationSec);
      const best = routes[0];
      if (!best) continue;
      const kmh = best.distanceM / 1000 / (best.durationSec / 3600);
      console.log(
        JSON.stringify({
          event: "osrm_route",
          provider: new URL(base).host,
          minutes: Math.round(best.durationSec / 60),
          kmh: Math.round(kmh * 10) / 10,
        }),
      );
      if (isWalkingPace(best.distanceM, best.durationSec)) return routes;
      if (kmh < fallbackKmh) {
        fallback = routes;
        fallbackKmh = kmh;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  if (fallback) return fallback;
  if (lastError === "NoRoute") {
    throw new Error("No walking route between those places.");
  }
  throw new Error(lastError);
}

function toRoute(route: NonNullable<OsrmBody["routes"]>[number]): OsrmRoute | null {
  const coordinates = route.geometry?.coordinates;
  if (!coordinates || coordinates.length < 2) return null;
  if (typeof route.duration !== "number" || typeof route.distance !== "number") return null;
  return {
    durationSec: route.duration,
    distanceM: route.distance,
    geometry: coordinates,
  };
}
