import assert from "node:assert/strict";
import test from "node:test";
import { chooseRoutes, type CandidateRoute } from "./choose";
import type { Poi } from "../types";

test("offers a two-minute detour past a park and six cafés", () => {
  const fastest: [number, number][] = [];
  for (let i = 0; i <= 24; i++) fastest.push([-0.12 + i * 0.001, 51.5]);

  const detour: [number, number][] = [];
  for (let i = 0; i <= 8; i++) detour.push([-0.12 + i * 0.001, 51.5]);
  for (let i = 0; i <= 8; i++) detour.push([-0.112, 51.5 + i * 0.00028]);
  for (let i = 0; i <= 6; i++) detour.push([-0.112 + i * 0.0006, 51.50224]);
  for (let i = 0; i <= 8; i++) detour.push([-0.1084, 51.50224 - i * 0.00028]);
  for (let i = 0; i <= 12; i++) detour.push([-0.108 + i * 0.001, 51.5]);

  const park: Poi = {
    id: "way/park",
    name: "Jubilee Gardens",
    kind: "park",
    lat: 51.5021,
    lon: -0.1102,
  };
  const cafes: Poi[] = Array.from({ length: 6 }, (_, index) => ({
    id: `node/cafe-${index}`,
    name: `Cafe ${index + 1}`,
    kind: "cafe" as const,
    lat: 51.50224,
    lon: -0.1116 + index * 0.00045,
  }));

  const sameStreets: CandidateRoute = {
    id: "same",
    durationSec: 1000,
    distanceM: 1500,
    geometry: fastest,
  };
  const tooLong: CandidateRoute = {
    id: "long",
    durationSec: 2100,
    distanceM: 4000,
    geometry: detour.map(([lon, lat]) => [lon, lat + 0.01] as [number, number]),
  };
  const choice = chooseRoutes(
    [
      { id: "direct", durationSec: 900, distanceM: 1400, geometry: fastest },
      sameStreets,
      tooLong,
      { id: "via-park", durationSec: 1020, distanceM: 1900, geometry: detour },
    ],
    [park, ...cafes],
  );

  assert.equal(choice.routes[0]?.kind, "fastest");
  assert.equal(choice.routes[0]?.summary, "Most direct");
  assert.equal(choice.routes.length, 2);
  const alive = choice.routes[1];
  assert.equal(alive?.extraMin, 2);
  assert.equal(alive?.summary, "+2 min, past a park and 6 cafés");
  assert.equal(alive?.name, "Via Jubilee Gardens");
  assert.ok(alive?.places.includes("Jubilee Gardens"));
  assert.equal(choice.rejectedLong >= 1, true);
  assert.equal(choice.rejectedSame >= 1, true);
});
