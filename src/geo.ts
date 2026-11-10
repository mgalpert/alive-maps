import type { LatLng } from "./types";

const EARTH_M = 6_371_000;

export function haversineM(a: LatLng, b: LatLng): number {
  const p1 = (a.lat * Math.PI) / 180;
  const p2 = (b.lat * Math.PI) / 180;
  const dp = ((b.lat - a.lat) * Math.PI) / 180;
  const dl = ((b.lon - a.lon) * Math.PI) / 180;
  const h =
    Math.sin(dp / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function toLine(coords: readonly [number, number][]): LatLng[] {
  return coords.map(([lon, lat]) => ({ lon, lat }));
}

export function polylineLengthM(line: readonly LatLng[]): number {
  let total = 0;
  for (let i = 1; i < line.length; i++) {
    const prev = line[i - 1];
    const next = line[i];
    if (!prev || !next) continue;
    total += haversineM(prev, next);
  }
  return total;
}

function project(p: LatLng, originLat: number): { x: number; y: number } {
  const lat0 = (originLat * Math.PI) / 180;
  return {
    x: ((p.lon * Math.PI) / 180) * Math.cos(lat0) * EARTH_M,
    y: ((p.lat * Math.PI) / 180) * EARTH_M,
  };
}

export function distanceToSegmentM(p: LatLng, a: LatLng, b: LatLng): number {
  const P = project(p, a.lat);
  const A = project(a, a.lat);
  const B = project(b, a.lat);
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1) return Math.hypot(P.x - A.x, P.y - A.y);
  const t = Math.max(0, Math.min(1, ((P.x - A.x) * dx + (P.y - A.y) * dy) / len2));
  return Math.hypot(P.x - (A.x + t * dx), P.y - (A.y + t * dy));
}

export function distanceToPolylineM(p: LatLng, line: readonly LatLng[]): number {
  const first = line[0];
  if (!first) return Infinity;
  if (line.length === 1) return haversineM(p, first);
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    if (!a || !b) continue;
    best = Math.min(best, distanceToSegmentM(p, a, b));
  }
  return best;
}

export type TrackHit = {
  distanceM: number;
  alongM: number;
};

/** Closest point on the line, plus how far that point is from the start. */
export function closestOnLine(p: LatLng, line: readonly LatLng[]): TrackHit {
  const first = line[0];
  if (!first) return { distanceM: Infinity, alongM: 0 };
  if (line.length === 1) return { distanceM: haversineM(p, first), alongM: 0 };
  let best: TrackHit = { distanceM: Infinity, alongM: 0 };
  let walked = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    if (!a || !b) continue;
    const seg = haversineM(a, b);
    const d = distanceToSegmentM(p, a, b);
    if (d < best.distanceM) {
      const P = project(p, a.lat);
      const A = project(a, a.lat);
      const B = project(b, a.lat);
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const len2 = dx * dx + dy * dy;
      const t =
        len2 < 1 ? 0 : Math.max(0, Math.min(1, ((P.x - A.x) * dx + (P.y - A.y) * dy) / len2));
      best = { distanceM: d, alongM: walked + seg * t };
    }
    walked += seg;
  }
  return best;
}

export type BBox = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export function bboxOf(line: readonly LatLng[], padM: number): BBox {
  const first = line[0];
  if (!first) return { south: 0, west: 0, north: 0, east: 0 };
  let south = first.lat;
  let north = first.lat;
  let west = first.lon;
  let east = first.lon;
  let latSum = 0;
  for (const point of line) {
    south = Math.min(south, point.lat);
    north = Math.max(north, point.lat);
    west = Math.min(west, point.lon);
    east = Math.max(east, point.lon);
    latSum += point.lat;
  }
  const midLat = latSum / line.length;
  const padLat = padM / 111_320;
  const cos = Math.cos((midLat * Math.PI) / 180);
  const padLon = padM / (111_320 * Math.max(0.2, Math.abs(cos)));
  return {
    south: south - padLat,
    north: north + padLat,
    west: west - padLon,
    east: east + padLon,
  };
}

/** Points spaced along the line, including the start. */
export function samplePolyline(line: readonly LatLng[], spacingM: number): LatLng[] {
  const first = line[0];
  if (!first) return [];
  const spacing = Math.max(1, spacingM);
  const out: LatLng[] = [first];
  let accumulated = 0;
  for (let i = 1; i < line.length; i++) {
    const start = line[i - 1];
    const end = line[i];
    if (!start || !end) continue;
    const seg = haversineM(start, end);
    if (seg < 0.5) continue;
    let covered = 0;
    while (accumulated + (seg - covered) >= spacing) {
      const need = spacing - accumulated;
      covered += need;
      const t = Math.min(1, covered / seg);
      out.push({
        lat: start.lat + (end.lat - start.lat) * t,
        lon: start.lon + (end.lon - start.lon) * t,
      });
      accumulated = 0;
      if (covered >= seg - 0.01) break;
    }
    accumulated += Math.max(0, seg - covered);
  }
  const last = line[line.length - 1];
  const tail = out[out.length - 1];
  if (last && tail && haversineM(tail, last) > 1) out.push(last);
  return out;
}

export function thinCoords(
  coords: readonly [number, number][],
  maxPoints: number,
): [number, number][] {
  if (coords.length <= maxPoints) return coords.slice();
  const step = Math.ceil(coords.length / maxPoints);
  const out: [number, number][] = [];
  for (let i = 0; i < coords.length; i += step) {
    const point = coords[i];
    if (point) out.push(point);
  }
  const last = coords[coords.length - 1];
  const tail = out[out.length - 1];
  if (last && tail && (tail[0] !== last[0] || tail[1] !== last[1])) out.push(last);
  return out;
}
