import assert from "node:assert/strict";
import test from "node:test";
import { isWalkingPace } from "./osrm";

test("accepts a walking pace and rejects the demo server's fast foot profile", () => {
  assert.equal(isWalkingPace(2220, 30 * 60), true);
  assert.equal(isWalkingPace(3230, 9 * 60), false);
});
