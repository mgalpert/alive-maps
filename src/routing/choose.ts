import { distanceToPolylineM, samplePolyline, thinCoords, toLine } from "../geo";
import {
  EMPTY_HIGHLIGHTS,
  type Highlights,
  type Poi,
  type PoiKind,
  type RouteOption,
} from "../types";
import { aliveSummary, isGenericName, placeNames, routeTitle, whyText } from "./summary";

const FAST_COLOR = "#3e4c59";
const ALIVE_COLORS = ["#1f7a4d", "#c45c26", "#245c6b"];

const BUFFER_M: Record<PoiKind, number> = {
  park: 110,
  architecture: 55,
  cafe: 40,
  eatery: 40,
  life: 40,
};

const KIND_ORDER: Record<PoiKind, number> = {
  park: 0,
  architecture: 1,
  cafe: 2,
  eatery: 3,
  life: 4,
};

export type CandidateRoute = {
  id: string;
  durationSec: number;
  distanceM: number;
  geometry: [number, number][];
  viaName?: string;
};

export type Choice = {
  routes: RouteOption[];
  rejectedLong: number;
  rejectedSame: number;
  rejectedQuiet: number;
};

type Scored = {
  route: CandidateRoute;
  hits: Poi[];
  highlights: Highlights;
};

/**
 * Keep the fastest walk, then up to three detours that pass places the
 * direct walk misses. Extra time is about 40% of the direct walk, and
 * always between 4 and 12 minutes, so a livelier option stays a small detour.
 */
export function chooseRoutes(candidates: CandidateRoute[], pois: readonly Poi[]): Choice {
  if (candidates.length === 0) {
    return { routes: [], rejectedLong: 0, rejectedSame: 0, rejectedQuiet: 0 };
  }
  const scored = candidates.map((route) => scoreRoute(route, pois));
  const fastest = scored.reduce((best, item) =>
    item.route.durationSec < best.route.durationSec ||
    (item.route.durationSec === best.route.durationSec && item.route.distanceM < best.route.distanceM)
      ? item
      : best,
  );
  const fastestMin = fastest.route.durationSec / 60;
  const maxExtra = Math.min(12, Math.max(4, Math.round(fastestMin * 0.4)));
  const fastIds = new Set(fastest.hits.map((poi) => poi.id));

  let rejectedLong = 0;
  let rejectedSame = 0;
  let rejectedQuiet = 0;
  const alive: { item: Scored; extraMin: number; novelPois: Poi[]; score: number }[] = [];

  for (const item of scored) {
    if (item.route.id === fastest.route.id) continue;
    const extraMin = Math.round((item.route.durationSec - fastest.route.durationSec) / 60);
    if (extraMin > maxExtra) {
      rejectedLong += 1;
      continue;
    }
    if (!routesAreDistinct(item.route.geometry, fastest.route.geometry)) {
      rejectedSame += 1;
      continue;
    }
    const novelPois = item.hits.filter((poi) => !fastIds.has(poi.id));
    const novel = count(novelPois);
    if (!isMeaningful(item.highlights, novel, extraMin, fastest.highlights)) {
      rejectedQuiet += 1;
      continue;
    }
    alive.push({
      item,
      extraMin,
      novelPois,
      score: aliveScore(item.highlights, novel, extraMin),
    });
  }

  alive.sort((a, b) => b.score - a.score || a.extraMin - b.extraMin);
  const picked: typeof alive = [];
  for (const candidate of alive) {
    if (picked.length >= 3) break;
    const distinct = picked.every((chosen) =>
      routesAreDistinct(candidate.item.route.geometry, chosen.item.route.geometry),
    );
    if (distinct) picked.push(candidate);
    else rejectedSame += 1;
  }

  const routes: RouteOption[] = [toFastest(fastest)];
  picked.forEach((candidate, index) => {
    routes.push(toAlive(candidate.item, candidate.extraMin, candidate.novelPois, index));
  });
  disambiguateTitles(routes);
  return { routes, rejectedLong, rejectedSame, rejectedQuiet };
}

function disambiguateTitles(routes: RouteOption[]): void {
  const used = new Set<string>();
  for (const route of routes) {
    if (route.kind !== "alive") continue;
    if (!used.has(route.name)) {
      used.add(route.name);
      continue;
    }
    const alternate = route.places.find((place) => !used.has(`Via ${place}`));
    if (alternate) route.name = `Via ${alternate}`;
    used.add(route.name);
  }
}

export function routesAreDistinct(
  left: readonly [number, number][],
  right: readonly [number, number][],
): boolean {
  const samples = samplePolyline(toLine(left), 50);
  if (samples.length < 2) return false;
  const other = toLine(right);
  const distances = samples.map((point) => distanceToPolylineM(point, other));
  const far = distances.filter((distance) => distance > 40).length;
  const max = distances.reduce((best, distance) => Math.max(best, distance), 0);
  return far / distances.length >= 0.12 && max > 60;
}

function scoreRoute(route: CandidateRoute, pois: readonly Poi[]): Scored {
  const line = toLine(route.geometry);
  const hits = pois.filter((poi) => distanceToPolylineM(poi, line) <= BUFFER_M[poi.kind]);
  return { route, hits, highlights: count(hits) };
}

function count(pois: readonly Poi[]): Highlights {
  const highlights = { ...EMPTY_HIGHLIGHTS };
  const seen = new Set<string>();
  for (const poi of pois) {
    const key = highlightKey(poi);
    if (seen.has(key)) continue;
    seen.add(key);
    if (poi.kind === "park") {
      if (!poi.name || isGenericName(poi.name)) continue;
      highlights.parks += 1;
    } else if (poi.kind === "cafe") highlights.cafes += 1;
    else if (poi.kind === "eatery") highlights.eateries += 1;
    else if (poi.kind === "architecture") highlights.architecture += 1;
    else highlights.life += 1;
  }
  return highlights;
}

function highlightKey(poi: Poi): string {
  if (poi.kind === "park" && poi.name) {
    return `park:${poi.name.split("(")[0]?.trim().toLowerCase()}`;
  }
  if (poi.name) return `${poi.kind}:${poi.name.trim().toLowerCase()}`;
  return poi.id;
}

function isMeaningful(
  highlights: Highlights,
  novel: Highlights,
  extraMin: number,
  fastest: Highlights,
): boolean {
  if (novel.parks >= 1 || novel.architecture >= 1) return true;
  if (novel.cafes + novel.eateries >= 2) return true;
  const food = highlights.cafes + highlights.eateries;
  const fastFood = fastest.cafes + fastest.eateries;
  return food >= 4 && extraMin <= 3 && (highlights.parks > fastest.parks || food > fastFood);
}

function aliveScore(highlights: Highlights, novel: Highlights, extraMin: number): number {
  return (
    highlights.parks * 12 +
    highlights.architecture * 7 +
    highlights.cafes * 4 +
    highlights.eateries * 3 +
    highlights.life +
    novel.parks * 6 +
    novel.architecture * 3 -
    extraMin * 2.5
  );
}

function toFastest(item: Scored): RouteOption {
  const places = placeNames(orderPois(item.hits, new Set()));
  return {
    id: "fastest",
    kind: "fastest",
    name: "Fastest",
    color: FAST_COLOR,
    durationSec: item.route.durationSec,
    distanceM: item.route.distanceM,
    extraMin: 0,
    summary: "Most direct",
    why: "The quickest walking route.",
    highlights: item.highlights,
    places,
    geometry: {
      type: "LineString",
      coordinates: thinCoords(item.route.geometry, 700),
    },
    pois: orderPois(item.hits, new Set()).slice(0, 12),
  };
}

function toAlive(item: Scored, extraMin: number, novelPois: Poi[], index: number): RouteOption {
  const novel = count(novelPois);
  const novelIds = new Set(novelPois.map((poi) => poi.id));
  const ordered = orderPois(item.hits, novelIds);
  const novelOrdered = orderPois(novelPois, novelIds);
  const places = placeNames(novelOrdered.length > 0 ? novelOrdered : ordered);
  return {
    id: `alive-${index + 1}`,
    kind: "alive",
    name: routeTitle(novelOrdered.length > 0 ? novelOrdered : ordered),
    color: ALIVE_COLORS[index] ?? ALIVE_COLORS[0] ?? FAST_COLOR,
    durationSec: item.route.durationSec,
    distanceM: item.route.distanceM,
    extraMin: Math.max(0, extraMin),
    summary: aliveSummary(Math.max(0, extraMin), item.highlights),
    why: whyText(novel, places),
    highlights: item.highlights,
    places,
    geometry: {
      type: "LineString",
      coordinates: thinCoords(item.route.geometry, 700),
    },
    pois: ordered.slice(0, 12),
  };
}

function orderPois(pois: readonly Poi[], novelIds: ReadonlySet<string>): Poi[] {
  return pois.slice().sort((a, b) => {
    const aNovel = novelIds.has(a.id) ? 0 : 1;
    const bNovel = novelIds.has(b.id) ? 0 : 1;
    if (aNovel !== bNovel) return aNovel - bNovel;
    const byKind = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (byKind !== 0) return byKind;
    if (a.name && !b.name) return -1;
    if (!a.name && b.name) return 1;
    return a.name.localeCompare(b.name);
  });
}
