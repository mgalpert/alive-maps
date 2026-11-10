import type { PoiKind } from "../../src/types";

export function formatMinutes(seconds: number): string {
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

export function formatDistance(meters: number): string {
  if (meters < 950) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

export function kindLabel(kind: string): string {
  const labels: Record<PoiKind, string> = {
    park: "Park",
    cafe: "Café",
    eatery: "Place to eat",
    architecture: "Landmark",
    life: "Lively spot",
  };
  return labels[kind as PoiKind] ?? "Place";
}
