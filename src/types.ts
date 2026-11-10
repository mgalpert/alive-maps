/** Shared API contract. Add optional fields only. Do not rename or remove fields. */

export type LatLng = {
  lat: number;
  lon: number;
};

export type PoiKind = "park" | "cafe" | "eatery" | "architecture" | "life";

export type Poi = {
  id: string;
  name: string;
  kind: PoiKind;
  lat: number;
  lon: number;
};

export type Highlights = {
  parks: number;
  cafes: number;
  eateries: number;
  architecture: number;
  life: number;
};

export type RouteKind = "fastest" | "alive";

export type LineString = {
  type: "LineString";
  coordinates: [number, number][];
};

export type RouteOption = {
  id: string;
  kind: RouteKind;
  name: string;
  color: string;
  durationSec: number;
  distanceM: number;
  extraMin: number;
  summary: string;
  why: string;
  highlights: Highlights;
  places: string[];
  geometry: LineString;
  pois: Poi[];
};

export type RoutesResponse = {
  origin: LatLng;
  destination: LatLng;
  routes: RouteOption[];
  notes: string[];
};

export type SearchResult = LatLng & {
  label: string;
};

export type SearchResponse = {
  results: SearchResult[];
};

export const EMPTY_HIGHLIGHTS: Highlights = {
  parks: 0,
  cafes: 0,
  eateries: 0,
  architecture: 0,
  life: 0,
};
