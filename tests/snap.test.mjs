import { test } from "node:test";
import assert from "node:assert/strict";
import { solveDrag, solveResize, exitDistance, wireTop, isFlat } from "../web/js/core/snap.js";

const base = { scale: 1, inPx: 8, outPx: 14, edges: true, wires: true, current: {} };

test("snaps the top edge to another node's top edge within the enter distance", () => {
  const r = solveDrag({ ...base, rect: { x: 0, y: 105, w: 100, h: 50 }, targets: [{ id: 1, x: 300, y: 100, w: 80, h: 40 }], wireTops: [] });
  assert.equal(r.y, 100);
  assert.equal(r.snapY.kind, "top");
  assert.equal(r.x, 0);
  assert.equal(r.snapX, null);
});

test("does not snap beyond the enter distance", () => {
  const r = solveDrag({ ...base, rect: { x: 0, y: 109, w: 100, h: 50 }, targets: [{ id: 1, x: 300, y: 100, w: 80, h: 40 }], wireTops: [] });
  assert.equal(r.y, 109);
  assert.equal(r.snapY, null);
});

test("distance is measured in screen pixels", () => {
  // 6 canvas units at scale 2 is 12 screen pixels: too far to enter
  const r = solveDrag({ ...base, scale: 2, rect: { x: 0, y: 106, w: 100, h: 50 }, targets: [{ id: 1, x: 300, y: 100, w: 80, h: 40 }], wireTops: [] });
  assert.equal(r.snapY, null);
  // 3 canvas units at scale 2 is 6 screen pixels: enters
  const r2 = solveDrag({ ...base, scale: 2, rect: { x: 0, y: 103, w: 100, h: 50 }, targets: [{ id: 1, x: 300, y: 100, w: 80, h: 40 }], wireTops: [] });
  assert.equal(r2.y, 100);
});

test("drag scope limits the canvas gap along each guide at every zoom level", () => {
  const input = {
    ...base, rect: { x: 3, y: 103, w: 100, h: 50 }, wireTops: [], targets: [
      { id: 1, x: 0, y: 253, w: 80, h: 40 }, // vertical guide across a 100-unit gap
      { id: 2, x: 204, y: 100, w: 80, h: 40 }, // horizontal guide across a 101-unit gap
    ],
  };
  for (const scale of [0.25, 1, 2]) {
    const limited = solveDrag({ ...input, scale, scope: 100 });
    assert.equal(limited.snapX?.key, "left:1", `zoom ${scale}`);
    assert.equal(limited.snapY, null, `zoom ${scale}`);
    assert.equal(solveDrag({ ...input, scale, scope: 0 }).snapY.key, "top:2");
  }
});

test("drag releases an edge snap outside the scope and still snaps to wires", () => {
  const input = {
    ...base, rect: { x: 3, y: 103, w: 100, h: 50 }, current: { y: "top:1" },
    targets: [{ id: 1, x: 300, y: 100, w: 80, h: 40 }], wireTops: [], scope: 40,
  };
  assert.equal(solveDrag(input).snapY, null);
  assert.equal(solveDrag({ ...input, wireTops: [{ key: "wire:1", top: 107 }] }).snapY.kind, "wire");
});

test("drag drops an edge snap if snapping on the other axis puts it out of scope", () => {
  const input = {
    ...base, rect: { x: 4, y: 100, w: 100, h: 50 }, wireTops: [], targets: [
      { id: 1, x: 0, y: 170, w: 80, h: 40 },
      { id: 2, x: 110, y: 95, w: 80, h: 40 },
    ],
  };
  const limited = solveDrag({ ...input, scope: 20 });
  assert.equal(limited.snapX, null);
  assert.equal(limited.snapY.key, "top:2");
  assert.equal(solveDrag(input).snapX.key, "left:1");
});

test("keeps the current snap until the exit distance, even when another candidate is nearer", () => {
  const targets = [{ id: 1, x: 300, y: 100, w: 80, h: 40 }, { id: 2, x: 600, y: 110, w: 80, h: 40 }];
  const first = solveDrag({ ...base, rect: { x: 0, y: 104, w: 100, h: 50 }, targets, wireTops: [] });
  assert.equal(first.snapY.key, "top:1");
  // raw y = 111 is 1 away from node 2's top but 11 (< 14) from the current snap
  const kept = solveDrag({ ...base, current: { y: first.snapY.key }, rect: { x: 0, y: 111, w: 100, h: 50 }, targets, wireTops: [] });
  assert.equal(kept.y, 100);
  // raw y = 115 is beyond the exit distance from 100: releases and takes the nearest within enter
  const moved = solveDrag({ ...base, current: { y: first.snapY.key }, rect: { x: 0, y: 115, w: 100, h: 50 }, targets, wireTops: [] });
  assert.equal(moved.y, 110);
});

test("picks the nearest candidate when not attached", () => {
  const targets = [{ id: 1, x: 300, y: 100, w: 80, h: 40 }, { id: 2, x: 600, y: 107, w: 80, h: 40 }];
  const r = solveDrag({ ...base, rect: { x: 0, y: 105, w: 100, h: 50 }, targets, wireTops: [] });
  assert.equal(r.y, 107);
});

test("bottom-to-bottom, abut above and below", () => {
  const t = [{ id: 1, x: 300, y: 100, w: 80, h: 40 }]; // bottom 140
  assert.equal(solveDrag({ ...base, rect: { x: 0, y: 93, w: 100, h: 50 }, targets: t, wireTops: [] }).y, 90); // my bottom 143 -> 140
  assert.equal(solveDrag({ ...base, rect: { x: 0, y: 144, w: 100, h: 50 }, targets: t, wireTops: [] }).snapY.kind, "below"); // my top -> 140
  assert.equal(solveDrag({ ...base, rect: { x: 0, y: 48, w: 100, h: 50 }, targets: t, wireTops: [] }).y, 50); // my bottom -> 100
});

test("horizontal edges: left, right, abut", () => {
  const t = [{ id: 1, x: 300, y: 1000, w: 80, h: 40 }];
  const at = (x) => solveDrag({ ...base, rect: { x, y: 0, w: 100, h: 50 }, targets: t, wireTops: [] });
  assert.equal(at(296).x, 300); // left-left
  assert.equal(at(283).x, 280); // right-right (380)
  assert.equal(at(384).x, 380); // abut right of it
  assert.equal(at(196).x, 200); // abut left of it
});

test("wire candidates snap the rect top to the value that makes the wire flat", () => {
  const r = solveDrag({ ...base, rect: { x: 0, y: 203, w: 100, h: 50 }, targets: [], wireTops: [{ key: "wire:7", top: 207.5 }] });
  assert.equal(r.y, 207.5);
  assert.equal(r.snapY.kind, "wire");
});

test("switches off wires or edges by option", () => {
  const t = [{ id: 1, x: 300, y: 100, w: 80, h: 40 }];
  assert.equal(solveDrag({ ...base, wires: false, rect: { x: 0, y: 203, w: 100, h: 50 }, targets: [], wireTops: [{ key: "w", top: 205 }] }).snapY, null);
  assert.equal(solveDrag({ ...base, edges: false, rect: { x: 0, y: 103, w: 100, h: 50 }, targets: t, wireTops: [] }).snapY, null);
});

test("exit distance keeps the playground ratio", () => {
  assert.equal(exitDistance(8), 14);
  assert.equal(exitDistance(4), 7);
});

test("resize from SE snaps the right edge to left/right edges and the bottom only to bottoms", () => {
  const t = [{ id: 1, x: 300, y: 100, w: 80, h: 40 }]; // right 380, bottom 140, top 100
  const r = solveResize({ ...base, corner: "SE", rect: { x: 0, y: 0, w: 296, h: 137 }, targets: t, minW: 50, minH: 50 });
  assert.equal(r.rect.w, 300); // right edge 296 -> 300 (target left)
  assert.equal(r.rect.h, 140); // bottom 137 -> 140
  // the bottom does not snap to a target's top
  const r2 = solveResize({ ...base, corner: "SE", rect: { x: 0, y: 0, w: 200, h: 97 }, targets: t, minW: 50, minH: 50 });
  assert.equal(r2.rect.h, 97);
});

test("resize from NW moves the left and top edges, keeping right and bottom", () => {
  const t = [{ id: 1, x: 300, y: 100, w: 80, h: 40 }];
  const r = solveResize({ ...base, corner: "NW", rect: { x: 383, y: 103, w: 117, h: 97 }, targets: t, minW: 50, minH: 50 });
  assert.deepEqual(r.rect, { x: 380, y: 100, w: 120, h: 100 });
  assert.equal(r.snapX.kind, "right");
  assert.equal(r.snapY.kind, "top");
});

test("resize scope accepts overlapping spans and rejects distant edges at every zoom level", () => {
  const input = {
    ...base, corner: "SE", rect: { x: 0, y: 0, w: 100, h: 50 }, targets: [
      { id: 1, x: 103, y: 20, w: 80, h: 100 },
      { id: 2, x: 204, y: 0, w: 80, h: 53 },
    ],
  };
  for (const scale of [0.25, 1, 2]) {
    const limited = solveResize({ ...input, scale, scope: 100 });
    assert.equal(limited.snapX?.key, "left:1", `zoom ${scale}`);
    assert.equal(limited.snapY, null, `zoom ${scale}`);
    assert.equal(solveResize({ ...input, scale, scope: 0 }).snapY.key, "bottom:2");
  }
});

test("resize drops a bottom snap when shrinking the width puts it out of scope", () => {
  const input = {
    ...base, corner: "SE", rect: { x: 0, y: 0, w: 100, h: 100 }, targets: [
      { id: 1, x: 95, y: 120, w: 60, h: 40 },
      { id: 2, x: 120, y: 65, w: 80, h: 40 },
    ],
  };
  const limited = solveResize({ ...input, scope: 20 });
  assert.deepEqual(limited.rect, { x: 0, y: 0, w: 95, h: 100 });
  assert.equal(limited.snapX.key, "left:1");
  assert.equal(limited.snapY, null);
  assert.equal(solveResize(input).snapY.key, "bottom:2");
});

test("resize never snaps below the minimum size", () => {
  const t = [{ id: 1, x: 40, y: 1000, w: 10, h: 10 }];
  const r = solveResize({ ...base, corner: "SE", rect: { x: 0, y: 0, w: 52, h: 60 }, targets: t, minW: 50, minH: 50 });
  assert.equal(r.rect.w, 50); // snapping to 50 is allowed (>= min)
  const r2 = solveResize({ ...base, corner: "SE", rect: { x: 0, y: 0, w: 52, h: 60 }, targets: [{ id: 2, x: 45, y: 1000, w: 0, h: 10 }], minW: 50, minH: 50 });
  assert.equal(r2.rect.w, 52);
});

test("top-to-top uses the top of the body (the header excluded)", () => {
  // a node with a 30 px header at y=70 (body top 100); a reroute without a header
  const node = { id: 1, x: 300, y: 70, w: 140, h: 76, head: 30 };
  const r = solveDrag({ ...base, rect: { x: 0, y: 103, w: 75, h: 26, head: 0 }, targets: [node], wireTops: [] });
  assert.equal(r.y, 100);
  assert.equal(r.snapY.kind, "top");
  // a headed node dragged next to a headless one: its body top meets the other's top
  const r2 = solveDrag({ ...base, rect: { x: 0, y: 73, w: 140, h: 76, head: 30 }, targets: [{ id: 2, x: 300, y: 100, w: 75, h: 26, head: 0 }], wireTops: [] });
  assert.equal(r2.y, 70);
});

test("abutting still uses the whole box, header included", () => {
  const t = { id: 1, x: 300, y: 100, w: 80, h: 40, head: 30 }; // box 100..140
  const r = solveDrag({ ...base, rect: { x: 0, y: 143, w: 100, h: 50, head: 30 }, targets: [t], wireTops: [] });
  assert.equal(r.y, 140);
  assert.equal(r.snapY.kind, "below");
});

test("resize from the top snaps the body top to other body tops", () => {
  const t = [{ id: 1, x: 300, y: 70, w: 80, h: 76, head: 30 }]; // body top 100
  const r = solveResize({ ...base, corner: "NE", rect: { x: 0, y: 73, w: 100, h: 127, head: 30 }, targets: t, minW: 10, minH: 10 });
  assert.equal(r.rect.y, 70); // my body top (y + 30) meets 100
});

test("a wire wins over edges: chosen first when both are near", () => {
  const t = [{ id: 1, x: 300, y: 100, w: 80, h: 40 }];
  const r = solveDrag({ ...base, rect: { x: 0, y: 102, w: 100, h: 50 }, targets: t, wireTops: [{ key: "wire:1", top: 106 }] });
  assert.equal(r.snapY.kind, "wire"); // the top edge (2 away) is nearer, but the wire (4 away) wins
});

test("attached to an edge, a wire coming within the enter distance takes over", () => {
  const t = [{ id: 1, x: 300, y: 100, w: 80, h: 40 }];
  // attached to top:1 at 100; raw 109 is within the exit distance of it, and 3 from the wire at 112
  const r = solveDrag({ ...base, current: { y: "top:1" }, rect: { x: 0, y: 109, w: 100, h: 50 }, targets: t, wireTops: [{ key: "wire:1", top: 112 }] });
  assert.equal(r.y, 112);
  assert.equal(r.snapY.kind, "wire");
});

test("attached to a wire, a nearer edge does not take over before the exit distance", () => {
  const t = [{ id: 1, x: 300, y: 100, w: 80, h: 40 }];
  const r = solveDrag({ ...base, current: { y: "wire:1" }, rect: { x: 0, y: 101, w: 100, h: 50 }, targets: t, wireTops: [{ key: "wire:1", top: 110 }] });
  assert.equal(r.y, 110);
});

test("a wire top is the box top at which the moving slot reaches the other end's height", () => {
  // grabbed node: pos.y 100, box top 70 (header 30); its slot is at 134, the other end at 200
  const top = wireTop(134, 200, 100, -30);
  assert.equal(top, 136); // the box moves down by 66, like the slot
  // a slot of another node that moves along works the same: only its distance to the other end counts
  assert.equal(wireTop(334, 400, 100, -30), 136);
  const snapped = solveDrag({ rect: { x: 0, y: 131, w: 100, h: 80, head: 30 }, targets: [], wireTops: [{ key: "wire:1", top }], scale: 1, inPx: 8, outPx: 14 });
  assert.equal(snapped.y, 136);
});

test("a wire is flat when its ends are within 0.5", () => {
  assert.equal(isFlat(100, 100.5), true);
  assert.equal(isFlat(100.5, 100), true);
  assert.equal(isFlat(100, 100.6), false);
});
