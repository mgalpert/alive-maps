import assert from "node:assert/strict";
import test from "node:test";
import { classify } from "./classify";

test("classifies the places a livelier walk cares about", () => {
  assert.equal(classify({ leisure: "park" }), "park");
  assert.equal(classify({ leisure: "playground" }), "park");
  assert.equal(classify({ amenity: "cafe" }), "cafe");
  assert.equal(classify({ shop: "bakery" }), "cafe");
  assert.equal(classify({ amenity: "restaurant" }), "eatery");
  assert.equal(classify({ historic: "monument" }), "architecture");
  assert.equal(classify({ tourism: "viewpoint" }), "architecture");
  assert.equal(classify({ amenity: "place_of_worship" }), "architecture");
  assert.equal(classify({ shop: "books" }), "life");
  assert.equal(classify({ leisure: "plaza" }), "life");
});

test("ignores vague historic tags and unrelated buildings", () => {
  assert.equal(classify({ historic: "yes" }), null);
  assert.equal(classify({ building: "garage" }), null);
  assert.equal(classify({ shop: "car" }), null);
});
