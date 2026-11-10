import assert from "node:assert/strict";
import test from "node:test";
import { pickWaypoints } from "./candidates";
import type { Poi } from "../types";

test("picks a park just off the middle of the direct walk", () => {
  const geometry: [number, number][] = [];
  for (let i = 0; i <= 20; i++) geometry.push([-0.12 + i * 0.001, 51.5]);
  const park: Poi = {
    id: "way/1",
    name: "Jubilee Gardens",
    kind: "park",
    lat: 51.5018,
    lon: -0.11,
  };
  const onRoute: Poi = {
    id: "node/2",
    name: "Already there",
    kind: "cafe",
    lat: 51.5,
    lon: -0.112,
  };
  const picked = pickWaypoints(
    [park, onRoute],
    geometry,
    { lat: 51.5, lon: -0.12 },
    { lat: 51.5, lon: -0.1 },
  );
  assert.deepEqual(
    picked.map((poi) => poi.name),
    ["Jubilee Gardens"],
  );
});
