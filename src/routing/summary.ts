import type { Highlights, Poi, PoiKind } from "../types";

export function aliveSummary(extraMin: number, highlights: Highlights): string {
  const parts: string[] = [];
  if (highlights.parks === 1) parts.push("a park");
  else if (highlights.parks > 1) parts.push(`${highlights.parks} parks`);
  const food = foodPhrase(highlights.cafes, highlights.eateries);
  if (food) parts.push(food);
  if (highlights.architecture === 1) parts.push("notable architecture");
  else if (highlights.architecture > 1) parts.push(`${highlights.architecture} landmarks`);
  if (parts.length < 2 && highlights.life >= 4) parts.push("lively shops");
  else if (parts.length < 2 && highlights.life > 0) parts.push("a lively street");
  const via = parts.slice(0, 2).join(" and ");
  const time = extraMin <= 0 ? "about the same time" : `+${extraMin} min`;
  return via ? `${time}, past ${via}` : time;
}

export function whyText(novel: Highlights, places: string[]): string {
  const parts: string[] = [];
  if (novel.parks === 1) parts.push("a park");
  else if (novel.parks > 1) parts.push(`${novel.parks} parks`);
  const food = novel.cafes + novel.eateries;
  if (food === 1) parts.push("a café");
  else if (food > 1) parts.push(`${food} cafés`);
  if (novel.architecture === 1) parts.push("a landmark");
  else if (novel.architecture > 1) parts.push(`${novel.architecture} landmarks`);
  if (parts.length === 0 && novel.life > 0) parts.push("a livelier block");
  const gain = parts.slice(0, 2).join(" and ");
  const place = places[0];
  if (gain && place) return `Adds ${gain} the direct walk misses, including ${place}.`;
  if (gain) return `Adds ${gain} the direct walk misses.`;
  return "A slightly different walk through a livelier block.";
}

export function routeTitle(places: { name: string; kind: PoiKind }[]): string {
  const named = places.filter((place) => place.name && !isGenericName(place.name));
  const park = named.find((place) => place.kind === "park");
  const landmark = named.find((place) => place.kind === "architecture");
  const cafe = named.find((place) => place.kind === "cafe" || place.kind === "eatery");
  const pick = park ?? landmark ?? cafe ?? named[0];
  if (!pick) return "Livelier walk";
  return `Via ${shortPlaceName(pick.name)}`;
}

export function placeNames(pois: Poi[], limit = 3): string[] {
  const names: string[] = [];
  for (const poi of pois) {
    if (!poi.name || isGenericName(poi.name)) continue;
    const short = shortPlaceName(poi.name);
    if (names.includes(short)) continue;
    names.push(short);
    if (names.length >= limit) break;
  }
  return names;
}

export function isGenericName(name: string): boolean {
  return /^(park|garden|playground|cafe|café|coffee|restaurant|bar|pub|church|shop|plaza|square)$/i.test(
    name.trim(),
  );
}

export function shortPlaceName(name: string): string {
  const cut = name.split(",")[0]?.split("(")[0]?.trim() || name.trim();
  return cut.length > 42 ? `${cut.slice(0, 41)}…` : cut;
}

function foodPhrase(cafes: number, eateries: number): string | null {
  if (cafes >= 2) return `${cafes} cafés`;
  if (cafes === 1 && eateries === 0) return "a café";
  const count = cafes + eateries;
  if (count <= 0) return null;
  if (count === 1) return cafes === 1 ? "a café" : "a place to eat";
  return `${count} places to eat`;
}
