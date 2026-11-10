import type { PoiKind } from "../types";

const SPECIFIC_HISTORIC = new Set([
  "building",
  "monument",
  "memorial",
  "church",
  "cathedral",
  "castle",
  "ruins",
  "city_gate",
  "manor",
  "tower",
  "fort",
  "citywalls",
  "wayside_shrine",
  "archaeological_site",
]);

const LIFE_SHOPS = new Set([
  "books",
  "florist",
  "clothes",
  "deli",
  "convenience",
  "coffee",
  "bakery",
  "greengrocer",
  "chocolate",
]);

/**
 * Map an OpenStreetMap tag set onto one alive-maps category.
 * Parks win over other tags on the same element. Vague `historic=yes`
 * is ignored so ordinary buildings do not all count as landmarks.
 */
export function classify(tags: Record<string, string>): PoiKind | null {
  const leisure = tags.leisure ?? "";
  if (leisure === "park" || leisure === "garden" || leisure === "playground") return "park";

  const tourism = tags.tourism ?? "";
  const amenity = tags.amenity ?? "";
  const historic = tags.historic ?? "";
  const building = tags.building ?? "";
  if (
    SPECIFIC_HISTORIC.has(historic) ||
    tourism === "attraction" ||
    tourism === "museum" ||
    tourism === "gallery" ||
    tourism === "viewpoint" ||
    amenity === "place_of_worship" ||
    building === "church" ||
    building === "cathedral" ||
    building === "chapel"
  ) {
    return "architecture";
  }

  const shop = tags.shop ?? "";
  if (amenity === "cafe" || shop === "bakery" || shop === "coffee") return "cafe";
  if (
    amenity === "restaurant" ||
    amenity === "bar" ||
    amenity === "pub" ||
    amenity === "ice_cream" ||
    amenity === "food_court"
  ) {
    return "eatery";
  }

  if (
    leisure === "plaza" ||
    tags.place === "square" ||
    amenity === "marketplace" ||
    amenity === "fountain" ||
    LIFE_SHOPS.has(shop)
  ) {
    return "life";
  }

  return null;
}
