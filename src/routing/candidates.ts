import { closestOnLine, haversineM, polylineLengthM, toLine } from "../geo";
import type { LatLng, Poi, PoiKind } from "../types";
import { isGenericName } from "./summary";

const KIND_WEIGHT: Record<PoiKind, number> = {
  park: 10,
  architecture: 8,
  cafe: 6,
  eatery: 4,
  life: 2,
};

type Scored = {
  poi: Poi;
  off: number;
  along: number;
  progress: number;
  weight: number;
};

/**
 * Pick a few places just off the direct walk to use as detour waypoints.
 * One from the early, middle, and late part of the walk, plus a park when
 * one is sitting nearby.
 */
export function pickWaypoints(
  pois: readonly Poi[],
  geometry: readonly [number, number][],
  origin: LatLng,
  destination: LatLng,
): Poi[] {
  const line = toLine(geometry);
  const length = polylineLengthM(line);
  if (length < 80) return [];

  const items: Scored[] = [];
  for (const poi of pois) {
    if (poi.kind === "life") continue;
    if (haversineM(poi, origin) < 160 || haversineM(poi, destination) < 160) continue;
    const track = closestOnLine(poi, line);
    if (track.distanceM < 50 || track.distanceM > 380) continue;
    const progress = track.alongM / length;
    if (progress < 0.12 || progress > 0.88) continue;
    const nameBonus = poi.name && !isGenericName(poi.name) ? 2 : 0;
    items.push({
      poi,
      off: track.distanceM,
      along: track.alongM,
      progress,
      weight: KIND_WEIGHT[poi.kind] + nameBonus,
    });
  }
  items.sort((a, b) => b.weight - a.weight || a.off - b.off);

  const buckets: Scored[][] = [[], [], []];
  for (const item of items) {
    const index = item.progress < 0.4 ? 0 : item.progress < 0.65 ? 1 : 2;
    buckets[index]?.push(item);
  }

  const picked: Scored[] = [];
  for (const bucket of buckets) {
    const best = bucket[0];
    if (!best) continue;
    if (picked.some((item) => haversineM(item.poi, best.poi) < 120)) continue;
    picked.push(best);
  }

  const park = items.find((item) => item.poi.kind === "park");
  if (park && !picked.some((item) => item.poi.id === park.poi.id)) {
    if (picked.length < 3) {
      picked.push(park);
    } else {
      const weakest = picked.reduce((left, right) => (left.weight < right.weight ? left : right));
      if (park.weight > weakest.weight) picked[picked.indexOf(weakest)] = park;
    }
  }

  for (const item of items) {
    if (picked.length >= 4) break;
    if (picked.some((chosen) => chosen.poi.id === item.poi.id)) continue;
    if (picked.some((chosen) => haversineM(chosen.poi, item.poi) < 180)) continue;
    picked.push(item);
  }

  return picked.sort((a, b) => a.along - b.along).map((item) => item.poi);
}
