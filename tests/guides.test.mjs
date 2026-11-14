import { test } from "node:test";
import assert from "node:assert/strict";
import { alignedGuides } from "../web/js/core/guides.mjs";

test("one guide per line, spanning every aligned box", () => {
  const me = { x: 0, y: 100, w: 100, h: 50 };
  const targets = [
    { id: 1, x: 300, y: 100, w: 80, h: 40 },
    { id: 2, x: 600, y: 100.3, w: 80, h: 40 },
    { id: 3, x: 900, y: 120, w: 80, h: 40 },
  ];
  const g = alignedGuides(me, targets);
  const tops = g.filter((l) => l.orient === "h" && Math.abs(l.at - 100) < 1);
  assert.equal(tops.length, 1);
  assert.equal(tops[0].from, 0);
  assert.equal(tops[0].to, 680);
});

test("vertical guides for left, right and abutting edges", () => {
  const me = { x: 200, y: 0, w: 100, h: 50 };
  const g = alignedGuides(me, [
    { id: 1, x: 200, y: 300, w: 50, h: 40 }, // left-left at 200
    { id: 2, x: 300, y: 500, w: 50, h: 40 }, // my right (300) touches its left
  ]);
  const xs = g.filter((l) => l.orient === "v").map((l) => l.at).sort((a, b) => a - b);
  assert.deepEqual(xs, [200, 300]);
  const at300 = g.find((l) => l.orient === "v" && l.at === 300);
  assert.equal(at300.from, 0);
  assert.equal(at300.to, 540);
});

test("nothing beyond 0.5", () => {
  assert.equal(alignedGuides({ x: 0, y: 0, w: 10, h: 10 }, [{ id: 1, x: 0.6, y: 100, w: 5, h: 5 }]).filter((l) => l.orient === "v").length, 0);
});

test("restricts to the given edges of mine", () => {
  const me = { x: 0, y: 0, w: 100, h: 50 };
  const t = [{ id: 1, x: 0, y: 200, w: 100, h: 40 }]; // left and right both aligned
  const g = alignedGuides(me, t, { edges: ["right"] });
  assert.deepEqual(g.map((l) => l.at), [100]);
});

test("top guides are drawn at the body tops", () => {
  const me = { x: 0, y: 100, w: 75, h: 26, head: 0 };
  const g = alignedGuides(me, [{ id: 1, x: 300, y: 70, w: 140, h: 76, head: 30 }]);
  const h = g.filter((l) => l.orient === "h");
  assert.deepEqual(h.map((l) => l.at), [100]); // aligned by the body tops
});

test("each guide lists the span of every box on it, so the gaps between boxes can be drawn apart", () => {
  const me = { x: 300, y: 100, w: 75, h: 26, head: 0 };
  const g = alignedGuides(me, [
    { id: 1, x: 0, y: 70, w: 140, h: 76, head: 30 },
    { id: 2, x: 600, y: 70, w: 200, h: 100, head: 30 },
  ]).find((l) => l.orient === "h");
  // a box without a header is on the line, so the line is drawn where the edges meet: the body tops
  assert.equal(g.at, 100);
  assert.equal(g.drawAt, 100);
  assert.deepEqual(g.spans, [[0, 140, 100], [300, 375, 100], [600, 800, 100]]);
});

test("a top guide between headed nodes is drawn at the top of the nodes", () => {
  const me = { x: 300, y: 70, w: 140, h: 76, head: 30 };
  const g = alignedGuides(me, [{ id: 1, x: 0, y: 70, w: 140, h: 76, head: 30 }]).find((l) => l.orient === "h");
  assert.equal(g.drawAt, 70);
  assert.deepEqual(g.spans, [[0, 140, 70], [300, 440, 70]]);
});
