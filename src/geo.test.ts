import assert from "node:assert/strict";
import test from "node:test";
import { distanceToPolylineM, haversineM, samplePolyline, toLine } from "./geo";

test("haversine is about 111 metres per 0.001 degree of latitude", () => {
  const meters = haversineM({ lat: 51.5, lon: -0.1 }, { lat: 51.501, lon: -0.1 });
  assert.ok(meters > 105 && meters < 116, `expected ~111m, got ${meters}`);
});

test("distance to a polyline is near zero on the line and grows off it", () => {
  const line = toLine([
    [-0.12, 51.5],
    [-0.1, 51.5],
  ]);
  const onLine = distanceToPolylineM({ lat: 51.5, lon: -0.11 }, line);
  const offLine = distanceToPolylineM({ lat: 51.502, lon: -0.11 }, line);
  assert.ok(onLine < 5, `on line ${onLine}`);
  assert.ok(offLine > 180 && offLine < 280, `off line ${offLine}`);
});

test("samplePolyline keeps spacing along a longer segment", () => {
  const samples = samplePolyline(
    [
      { lat: 51.5, lon: -0.12 },
      { lat: 51.5, lon: -0.1 },
    ],
    200,
  );
  assert.ok(samples.length >= 5, `samples ${samples.length}`);
});
