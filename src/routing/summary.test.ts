import assert from "node:assert/strict";
import test from "node:test";
import { aliveSummary, routeTitle, whyText } from "./summary";

test("summarizes a small detour the way the product promises", () => {
  assert.equal(
    aliveSummary(2, { parks: 1, cafes: 6, eateries: 0, architecture: 0, life: 0 }),
    "+2 min, past a park and 6 cafés",
  );
});

test("names a route after the park it adds", () => {
  assert.equal(routeTitle([{ name: "Jubilee Gardens", kind: "park" }]), "Via Jubilee Gardens");
  assert.equal(
    whyText({ parks: 1, cafes: 6, eateries: 0, architecture: 0, life: 0 }, ["Jubilee Gardens"]),
    "Adds a park and 6 cafés the direct walk misses, including Jubilee Gardens.",
  );
});
