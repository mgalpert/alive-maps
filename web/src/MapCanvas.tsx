import maplibregl, { type GeoJSONSource, type Map } from "maplibre-gl";
import { useEffect, useRef } from "react";
import type { RouteOption, SearchResult } from "../../src/types";
import { kindLabel } from "./format";

const STYLE = "https://tiles.openfreemap.org/styles/liberty";

type Props = {
  origin: SearchResult | null;
  destination: SearchResult | null;
  routes: RouteOption[];
  selectedId: string | null;
};

export function MapCanvas({ origin, destination, routes, selectedId }: Props) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const fitted = useRef("");
  const data = useRef({ origin, destination, routes, selectedId });
  data.current = { origin, destination, routes, selectedId };

  const selected = routes.find((route) => route.id === selectedId) ?? routes[0] ?? null;
  const label = selected
    ? `Map showing ${selected.name}: ${selected.summary}`
    : "Map. Choose a start and end to see walking routes.";

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const map = new maplibregl.Map({
      container: element,
      style: STYLE,
      center: [-0.11, 51.51],
      zoom: 12,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    const apply = () => {
      if (!map.isStyleLoaded() || !map.getSource("routes")) return;
      const current = data.current;
      const chosen =
        current.routes.find((route) => route.id === current.selectedId) ?? current.routes[0] ?? null;
      const routeSource = map.getSource("routes");
      const poiSource = map.getSource("pois");
      if (isGeoJson(routeSource)) {
        routeSource.setData({
          type: "FeatureCollection",
          features: [...current.routes]
            .sort((a, b) => Number(a.id === chosen?.id) - Number(b.id === chosen?.id))
            .map((route) => ({
              type: "Feature" as const,
              properties: {
                id: route.id,
                color: route.color,
                selected: route.id === chosen?.id ? 1 : 0,
              },
              geometry: route.geometry,
            })),
        });
      }
      if (isGeoJson(poiSource)) {
        poiSource.setData({
          type: "FeatureCollection",
          features: (chosen?.pois ?? [])
            .filter((poi) => poi.name)
            .map((poi) => ({
              type: "Feature" as const,
              properties: { name: poi.name, kind: poi.kind },
              geometry: { type: "Point" as const, coordinates: [poi.lon, poi.lat] },
            })),
        });
      }
      drawEnds(map, markers.current, current.origin, current.destination);
      const fitKey = `${chosen?.id ?? ""}:${current.origin?.lat ?? ""}:${current.destination?.lat ?? ""}`;
      if (chosen && fitKey !== fitted.current) {
        fitted.current = fitKey;
        const bounds = new maplibregl.LngLatBounds();
        for (const coord of chosen.geometry.coordinates) bounds.extend(coord);
        if (!bounds.isEmpty()) {
          const wide = window.matchMedia("(min-width: 900px)").matches;
          const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          map.fitBounds(bounds, {
            padding: wide
              ? { top: 72, bottom: 48, left: 440, right: 56 }
              : { top: 24, bottom: window.innerHeight * 0.5, left: 28, right: 28 },
            maxZoom: 16,
            duration: reduced ? 0 : 700,
          });
        }
      }
    };

    map.on("load", () => {
      map.addSource("routes", { type: "geojson", data: emptyCollection() });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "routes",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["case", ["==", ["get", "selected"], 1], 7, 3.5],
          "line-opacity": ["case", ["==", ["get", "selected"], 1], 0.95, 0.38],
        },
      });
      map.addSource("pois", { type: "geojson", data: emptyCollection() });
      map.addLayer({
        id: "poi-circles",
        type: "circle",
        source: "pois",
        paint: {
          "circle-radius": 5.5,
          "circle-color": [
            "match",
            ["get", "kind"],
            "park",
            "#1f7a4d",
            "cafe",
            "#c45c26",
            "eatery",
            "#a15c28",
            "architecture",
            "#245c6b",
            "life",
            "#6d5a32",
            "#1c2416",
          ],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#f7f3ea",
        },
      });
      map.on("click", "poi-circles", (event) => {
        const feature = event.features?.[0];
        const name = feature?.properties?.name;
        const kind = feature?.properties?.kind;
        if (typeof name !== "string") return;
        new maplibregl.Popup({ closeButton: false, offset: 12 })
          .setLngLat(event.lngLat)
          .setHTML(
            `<strong>${escapeHtml(name)}</strong><div>${escapeHtml(kindLabel(String(kind ?? "")))}</div>`,
          )
          .addTo(map);
      });
      map.on("mouseenter", "poi-circles", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "poi-circles", () => {
        map.getCanvas().style.cursor = "";
      });
      apply();
    });

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(element);
    return () => {
      observer.disconnect();
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getSource("routes")) return;
    const chosen = routes.find((route) => route.id === selectedId) ?? routes[0] ?? null;
    const routeSource = map.getSource("routes");
    const poiSource = map.getSource("pois");
    if (isGeoJson(routeSource)) {
      routeSource.setData({
        type: "FeatureCollection",
        features: [...routes]
          .sort((a, b) => Number(a.id === chosen?.id) - Number(b.id === chosen?.id))
          .map((route) => ({
            type: "Feature" as const,
            properties: {
              id: route.id,
              color: route.color,
              selected: route.id === chosen?.id ? 1 : 0,
            },
            geometry: route.geometry,
          })),
      });
    }
    if (isGeoJson(poiSource)) {
      poiSource.setData({
        type: "FeatureCollection",
        features: (chosen?.pois ?? [])
          .filter((poi) => poi.name)
          .map((poi) => ({
            type: "Feature" as const,
            properties: { name: poi.name, kind: poi.kind },
            geometry: { type: "Point" as const, coordinates: [poi.lon, poi.lat] },
          })),
      });
    }
    drawEnds(map, markers.current, origin, destination);
    const fitKey = `${chosen?.id ?? ""}:${origin?.lat ?? ""}:${destination?.lat ?? ""}`;
    if (chosen && fitKey !== fitted.current) {
      fitted.current = fitKey;
      const bounds = new maplibregl.LngLatBounds();
      for (const coord of chosen.geometry.coordinates) bounds.extend(coord);
      if (!bounds.isEmpty()) {
        const wide = window.matchMedia("(min-width: 900px)").matches;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        map.fitBounds(bounds, {
          padding: wide
            ? { top: 72, bottom: 48, left: 440, right: 56 }
            : { top: 24, bottom: window.innerHeight * 0.5, left: 28, right: 28 },
          maxZoom: 16,
          duration: reduced ? 0 : 700,
        });
      }
    }
  }, [origin, destination, routes, selectedId]);

  return <div ref={container} className="map" role="img" aria-label={label} />;
}

function isGeoJson(source: unknown): source is GeoJSONSource {
  return typeof source === "object" && source !== null && "type" in source && source.type === "geojson";
}

function emptyCollection(): {
  type: "FeatureCollection";
  features: never[];
} {
  return { type: "FeatureCollection", features: [] };
}

function drawEnds(
  map: Map,
  bucket: maplibregl.Marker[],
  origin: SearchResult | null,
  destination: SearchResult | null,
) {
  bucket.forEach((marker) => marker.remove());
  bucket.length = 0;
  if (origin) bucket.push(pin(map, origin, "A", "a"));
  if (destination) bucket.push(pin(map, destination, "B", "b"));
}

function pin(map: Map, place: SearchResult, letter: string, tone: "a" | "b"): maplibregl.Marker {
  const element = document.createElement("div");
  element.className = `pin pin-${tone}`;
  element.textContent = letter;
  return new maplibregl.Marker({ element, anchor: "center" })
    .setLngLat([place.lon, place.lat])
    .addTo(map);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
