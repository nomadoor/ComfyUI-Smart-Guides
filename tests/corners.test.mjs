import { test } from "node:test";
import assert from "node:assert/strict";
import { cornerAt, gripSegments } from "../web/js/core/corners.js";

const r = { x: 100, y: 100, w: 400, h: 300 };

test("each corner reaches 16 inside and 4 outside, like a Nodes 2.0 node's resize handle", () => {
  assert.equal(cornerAt(r, 110, 110), "NW");
  assert.equal(cornerAt(r, 97, 97), "NW"); // just outside the group
  assert.equal(cornerAt(r, 490, 110), "NE");
  assert.equal(cornerAt(r, 503, 103), "NE");
  assert.equal(cornerAt(r, 110, 390), "SW");
  assert.equal(cornerAt(r, 503, 403), "SE");
  assert.equal(cornerAt(r, 117, 110), null); // 17 inside
  assert.equal(cornerAt(r, 95, 95), null); // 5 outside
  assert.equal(cornerAt(r, 300, 110), null); // the title, not a corner
});

test("the inside part never exceeds a quarter of the group, so a small group can still be moved", () => {
  const small = { x: 0, y: 0, w: 40, h: 40 };
  assert.equal(cornerAt(small, 9, 9), "NW");
  assert.equal(cornerAt(small, 11, 9), null);
});

test("the grip is two diagonal strokes in the 8 x 8 square that sits 4 inside the corner", () => {
  const se = gripSegments(r, "SE"); // the corner is at (500, 400): the square is 488..496 x 388..396
  assert.equal(se.length, 2);
  for (const [x1, y1, x2, y2] of se) {
    for (const x of [x1, x2]) assert.ok(x >= 488 && x <= 496);
    for (const y of [y1, y2]) assert.ok(y >= 388 && y <= 396);
    assert.ok(Math.abs((x1 - x2) + (y1 - y2)) < 1e-9); // runs at 45 degrees, from top right to bottom left
  }
  // the other corners mirror it: NW is SE turned around the middle of the box
  const nw = gripSegments(r, "NW");
  se.forEach((seg, i) => seg.forEach((v, j) => {
    const mirrored = (j % 2 === 0 ? 2 * (r.x + r.w / 2) : 2 * (r.y + r.h / 2)) - v;
    assert.ok(Math.abs(nw[i][j] - mirrored) < 1e-9);
  }));
  const ne = gripSegments(r, "NE");
  se.forEach((seg, i) => seg.forEach((v, j) => {
    const expected = j % 2 === 0 ? v : 2 * (r.y + r.h / 2) - v; // same x, y mirrored
    assert.ok(Math.abs(ne[i][j] - expected) < 1e-9);
  }));
});
