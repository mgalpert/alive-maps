import type { BBox } from "../geo";
import { fetchExternal } from "../http";
import type { Poi } from "../types";
import { cachedJson, type CacheStore } from "./cache";
import { classify } from "./classify";

// The main Overpass cluster often times out from cloud hosts. The French
// mirror answers a neighbourhood query in a few seconds.
const ENDPOINTS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

type OverpassElement = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

type OverpassBody = {
  elements?: OverpassElement[];
  remark?: string;
};

export type PoiQuery = {
  pois: Poi[];
  ok: boolean;
};

export async function fetchPois(
  bbox: BBox,
  ctx: { cache: CacheStore; userAgent: string },
): Promise<PoiQuery> {
  const key = [
    "overpass:v1",
    bbox.south.toFixed(3),
    bbox.west.toFixed(3),
    bbox.north.toFixed(3),
    bbox.east.toFixed(3),
  ].join(":");
  try {
    return await cachedJson(ctx.cache, key, 6 * 60 * 60, async () => {
      const pois = await loadPois(bbox, ctx.userAgent);
      return { pois, ok: true };
    });
  } catch (err) {
    console.warn(
      JSON.stringify({
        event: "overpass_failed",
        message: err instanceof Error ? err.message : String(err),
      }),
    );
    return { pois: [], ok: false };
  }
}

async function loadPois(bbox: BBox, userAgent: string): Promise<Poi[]> {
  const query = overpassQuery(bbox);
  let lastError = "Overpass failed";
  for (const endpoint of ENDPOINTS) {
    try {
      const response = await fetchExternal(endpoint, {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: { "content-type": "application/x-www-form-urlencoded" },
        timeoutMs: 16_000,
        userAgent,
      });
      const text = await response.text();
      if (!response.ok) {
        lastError = `Overpass ${response.status}`;
        continue;
      }
      const body = JSON.parse(text) as OverpassBody;
      if (!body.elements?.length) {
        lastError = body.remark ?? "Overpass returned no elements";
        continue;
      }
      return prioritize(dedupe(body.elements.map(toPoi).filter((poi): poi is Poi => poi !== null))).slice(
        0,
        800,
      );
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(lastError);
}

function overpassQuery(bbox: BBox): string {
  const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  // Ways and nodes only. Relations make this query too slow on public Overpass.
  return `[out:json][timeout:15];
(
  way["leisure"~"^(park|garden|playground|plaza)$"](${box});
  node["leisure"~"^(park|garden|playground|plaza)$"](${box});
  node["amenity"~"^(cafe|restaurant|bar|pub|ice_cream|place_of_worship|fountain)$"](${box});
  node["shop"~"^(bakery|coffee|books|florist|clothes|deli|convenience)$"](${box});
  node["tourism"~"^(attraction|museum|gallery|viewpoint)$"](${box});
  way["tourism"~"^(attraction|museum|gallery)$"](${box});
  way["historic"~"^(monument|church|cathedral|castle|ruins)$"](${box});
  node["historic"~"^(monument|church|cathedral)$"](${box});
  way["building"~"^(church|cathedral|chapel)$"](${box});
  way["amenity"="place_of_worship"](${box});
);
out center tags;`;
}

const KIND_RANK: Record<Poi["kind"], number> = {
  park: 0,
  architecture: 1,
  cafe: 2,
  eatery: 3,
  life: 4,
};

function prioritize(pois: Poi[]): Poi[] {
  return pois.slice().sort((a, b) => {
    const byKind = KIND_RANK[a.kind] - KIND_RANK[b.kind];
    if (byKind !== 0) return byKind;
    if (a.name && !b.name) return -1;
    if (!a.name && b.name) return 1;
    return a.id.localeCompare(b.id);
  });
}

function toPoi(element: OverpassElement): Poi | null {
  const tags = element.tags ?? {};
  const kind = classify(tags);
  if (!kind || element.id === undefined || !element.type) return null;
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (lat === undefined || lon === undefined) return null;
  const name = (tags.name || tags["name:en"] || "").trim();
  return { id: `${element.type}/${element.id}`, name, kind, lat, lon };
}

function dedupe(pois: Poi[]): Poi[] {
  const kept: Poi[] = [];
  for (const poi of pois) {
    const match = kept.find(
      (existing) =>
        existing.kind === poi.kind &&
        Math.abs(existing.lat - poi.lat) < 0.0004 &&
        Math.abs(existing.lon - poi.lon) < 0.0006 &&
        (!poi.name || !existing.name || existing.name === poi.name),
    );
    if (!match) {
      kept.push(poi);
      continue;
    }
    if (!match.name && poi.name) match.name = poi.name;
  }
  return kept;
}
