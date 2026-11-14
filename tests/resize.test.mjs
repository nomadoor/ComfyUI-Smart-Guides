import { test } from "node:test";
import assert from "node:assert/strict";
import { movingEdges, withMovingEdges, resizedBy, withEdgesOf, withEdgesOnGrid, withMinSize } from "../web/js/core/resize.mjs";

const r = { x: 100, y: 200, w: 300, h: 150 };

test("the corner names the two edges that move", () => {
  assert.deepEqual(movingEdges(r, "NW"), [100, 200]);
  assert.deepEqual(movingEdges(r, "NE"), [400, 200]);
  assert.deepEqual(movingEdges(r, "SW"), [100, 350]);
  assert.deepEqual(movingEdges(r, "SE"), [400, 350]);
});

test("putting the moving edges somewhere keeps the opposite edges", () => {
  assert.deepEqual(withMovingEdges(r, "SE", [450, 400]), { x: 100, y: 200, w: 350, h: 200 });
  assert.deepEqual(withMovingEdges(r, "NW", [80, 170]), { x: 80, y: 170, w: 320, h: 180 });
  assert.deepEqual(withMovingEdges(r, "NE", [450, 170]), { x: 100, y: 170, w: 350, h: 180 });
  assert.deepEqual(withMovingEdges(r, "SW", [80, 400]), { x: 80, y: 200, w: 320, h: 200 });
  // other fields (the header height) are carried along, and the start is not changed
  const headed = { ...r, head: 30 };
  assert.equal(withMovingEdges(headed, "SE", [450, 400]).head, 30);
  assert.deepEqual(headed, { ...r, head: 30 });
});

test("moving edges and putting them back are inverse", () => {
  for (const corner of ["NW", "NE", "SW", "SE"]) {
    const moved = withMovingEdges(r, corner, [333, 222]);
    assert.deepEqual(movingEdges(moved, corner), [333, 222]);
  }
});

test("resizing by a pointer travel moves only the corner's edges", () => {
  assert.deepEqual(resizedBy(r, "SE", 20, -10), { x: 100, y: 200, w: 320, h: 140 });
  assert.deepEqual(resizedBy(r, "NW", 20, -10), { x: 120, y: 190, w: 280, h: 160 });
  assert.deepEqual(resizedBy(r, "NE", 20, -10), { x: 100, y: 190, w: 320, h: 160 });
  assert.deepEqual(resizedBy(r, "SW", 20, -10), { x: 120, y: 200, w: 280, h: 140 });
});

test("snapped edges are put back after the size was rounded, one axis at a time", () => {
  const want = { x: 100, y: 200, w: 303, h: 147 }; // the right edge snapped to 403, the bottom to 347
  const rounded = { x: 100, y: 200, w: 300, h: 150 }; // what the grid made of it
  assert.deepEqual(withEdgesOf(rounded, want, "SE", true, false), { x: 100, y: 200, w: 303, h: 150 });
  assert.deepEqual(withEdgesOf(rounded, want, "SE", false, true), { x: 100, y: 200, w: 300, h: 147 });
  assert.deepEqual(withEdgesOf(rounded, want, "SE", false, false), rounded);
  // a west / north corner moves the origin and keeps the right and bottom edges of the rounded rect
  const wantNW = { x: 97, y: 203, w: 303, h: 147 };
  assert.deepEqual(withEdgesOf(rounded, wantNW, "NW", true, true), { x: 97, y: 203, w: 303, h: 147 });
});

test("free edges round to the grid; the opposite edges stay", () => {
  const odd = { x: 103, y: 204, w: 294, h: 143 }; // right edge 397, bottom 347
  assert.deepEqual(withEdgesOnGrid(odd, "SE", 10, true, true), { x: 103, y: 204, w: 297, h: 146 }); // right 400, bottom 350
  assert.deepEqual(withEdgesOnGrid(odd, "NW", 10, true, true), { x: 100, y: 200, w: 297, h: 147 }); // right 397 and bottom 347 stay
  assert.deepEqual(withEdgesOnGrid(odd, "SE", 10, false, true), { x: 103, y: 204, w: 294, h: 146 });
  assert.deepEqual(withEdgesOnGrid(odd, "NW", 10, true, false), { x: 100, y: 204, w: 297, h: 143 });
});

test("the minimum size keeps the edges the corner does not move", () => {
  const start = { x: 100, y: 200, w: 300, h: 150 }; // right edge 400, bottom 350
  assert.deepEqual(withMinSize({ x: 100, y: 200, w: 50, h: 20 }, start, "SE", 140, 80), { x: 100, y: 200, w: 140, h: 80 });
  assert.deepEqual(withMinSize({ x: 350, y: 330, w: 50, h: 20 }, start, "NW", 140, 80), { x: 260, y: 270, w: 140, h: 80 });
  const fine = { x: 100, y: 200, w: 200, h: 100 };
  assert.deepEqual(withMinSize(fine, start, "NW", 140, 80), fine);
});
