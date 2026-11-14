import { test } from "node:test";
import assert from "node:assert/strict";
import { deltaModel, absoluteModel, canvasResizeModel, clientResizeModel, inAutoPanBand, AUTO_PAN_EDGE_PX } from "../web/js/core/pointer_model.mjs";

// solve: snap y to 100 when within 5 canvas units, x unchanged
const solve = ([x, y]) => [x, Math.abs(y - 100) <= 5 ? 100 : y];

test("delta model (classic): rewrites so the item lands on the snapped position", () => {
  const m = deltaModel({ itemPos: [0, 50], lastReal: [10, 10] });
  // real pointer moves 47 screen px down at scale 1 -> raw y 97 -> snapped 100
  const out = m.step({ real: [10, 57], itemPos: [0, 50], scale: 1, lastDelivered: [10, 10] }, solve, true);
  assert.deepEqual(out.delivered, [10, 60]); // frontend moves by +50 -> 100
  // next event, frontend moved the item to 100; pointer moves 2 more px -> raw 99 -> stays 100
  const out2 = m.step({ real: [10, 59], itemPos: [0, 100], scale: 1, lastDelivered: [10, 60] }, solve, true);
  assert.deepEqual(out2.delivered, [10, 60]); // no further movement
});

test("delta model: auto-pan moves the item without events; the model follows", () => {
  const m = deltaModel({ itemPos: [0, 0], lastReal: [0, 0] });
  m.step({ real: [0, 10], itemPos: [0, 0], scale: 1, lastDelivered: [0, 0] }, (p) => p, true); // raw 10
  // auto-pan moved the item by +30 between events
  const out = m.step({ real: [0, 12], itemPos: [0, 40], scale: 1, lastDelivered: [0, 10] }, (p) => p, true);
  // raw = 10 + 30 + 2 = 42 -> frontend should move by +2
  assert.deepEqual(out.delivered, [0, 12]);
});

test("delta model: no rewrite when off, but the bookkeeping continues", () => {
  const m = deltaModel({ itemPos: [0, 0], lastReal: [0, 0] });
  const out = m.step({ real: [0, 97], itemPos: [0, 0], scale: 1, lastDelivered: [0, 0] }, solve, false);
  assert.equal(out.delivered, null);
  // frontend moved by 97; now snapping on again, raw 99 -> 100
  const out2 = m.step({ real: [0, 99], itemPos: [0, 97], scale: 1, lastDelivered: [0, 97] }, solve, true);
  assert.deepEqual(out2.delivered, [0, 100]);
});

test("absolute model (Nodes 2.0): position is start + pointer travel / scale", () => {
  const m = absoluteModel({ startPos: [0, 50], pressClient: [10, 10], offset: [0, 0], scale: 2 });
  // 2x zoom: 94 screen px = 47 canvas -> raw 97 -> 100 -> delivered press + 50*2
  const out = m.step({ real: [10, 104], offset: [0, 0], scale: 2 }, solve, true);
  assert.deepEqual(out.delivered, [10, 110]);
});

test("absolute model: a pan of the view (auto-pan, Space) shifts the frontend's start position", () => {
  const m = absoluteModel({ startPos: [0, 0], pressClient: [0, 0], offset: [0, 0], scale: 1 });
  // the pointer is at the canvas edge, so the frontend auto-pans after this event
  m.step({ real: [0, 10], offset: [0, 0], scale: 1, shiftsStart: true }, (p) => p, true);
  // auto-pan scrolled the view: offset -= 30 and the frontend added +30 to its start position
  const out = m.step({ real: [0, 10], offset: [0, -30], scale: 1, shiftsStart: false }, solve, false);
  assert.equal(out.raw[1], 40);
  // snap target 100: pointer at 65 -> raw 30 + 65 = 95 -> 100 -> delivered so that start(30) + d = 100
  const out2 = m.step({ real: [0, 65], offset: [0, -30], scale: 1 }, solve, true);
  assert.deepEqual(out2.delivered, [0, 70]);
});

test("absolute model: a zoom does not count as a pan", () => {
  const m = absoluteModel({ startPos: [0, 0], pressClient: [0, 0], offset: [0, 0], scale: 1 });
  const out = m.step({ real: [0, 10], offset: [-50, -50], scale: 2 }, (p) => p, false);
  assert.deepEqual(out.raw, [0, 5]);
});

test("canvas resize model (classic): edge follows the pointer in canvas coordinates", () => {
  const m = canvasResizeModel({ startEdge: [200, 300], pressCanvas: [195, 295] });
  // pointer at canvas (250, 340): raw edges (255, 345); snap right edge to 260
  const out = m.step({ pointerCanvas: [250, 340], offset: [0, 0], scale: 1 }, () => [260, 345], true);
  assert.deepEqual(out.raw, [255, 345]);
  assert.deepEqual(out.delivered, [255, 340]); // client = canvas at scale 1, offset 0
  const out2 = m.step({ pointerCanvas: [250, 340], offset: [10, 0], scale: 2 }, () => [260, 345], true);
  assert.deepEqual(out2.delivered, [(255 + 10) * 2, 340 * 2]);
});

test("client resize model (Nodes 2.0): edge = start + pointer travel / scale", () => {
  const m = clientResizeModel({ startEdge: [200, 300], pressClient: [100, 100] });
  const out = m.step({ real: [120, 100], scale: 2 }, () => [212, 300], true);
  assert.deepEqual(out.raw, [210, 300]);
  assert.deepEqual(out.delivered, [124, 100]);
});

test("absolute model: a pan that does not shift the frontend's start (wheel) is not counted", () => {
  const m = absoluteModel({ startPos: [0, 0], pressClient: [0, 0], offset: [0, 0], scale: 1 });
  m.step({ real: [0, 10], offset: [0, 0], scale: 1 }, (p) => p, false);
  // the wheel scrolled the view by 40, away from the canvas edge and not in Space pan
  const out = m.step({ real: [0, 12], offset: [0, -40], scale: 1, shiftsStart: false }, (p) => p, false);
  assert.deepEqual(out.raw, [0, 12]);
});

test("absolute model: the offset change seen at an event was caused by the previous one (Space pan)", () => {
  // the frontend handles event k after the model saw it: a read-only (Space) move shifts the
  // offset and the frontend's start while handling it, which the model sees at event k + 1
  const m = absoluteModel({ startPos: [0, 0], pressClient: [0, 0], offset: [0, 0], scale: 1 });
  m.step({ real: [0, 10], offset: [0, 0], scale: 1, shiftsStart: false }, (p) => p, false);
  m.step({ real: [0, 17], offset: [0, 0], scale: 1, shiftsStart: true }, (p) => p, false); // Space held
  // Space released; this event sees the 7 px pan caused by the previous (read-only) move
  const out = m.step({ real: [0, 17], offset: [0, -7], scale: 1, shiftsStart: false }, (p) => p, false);
  assert.deepEqual(out.raw, [0, 24]); // start shifted by 7
});

test("absolute model: whether the frontend will shift its start can be set after solving (auto-pan on the delivered pointer)", () => {
  const m = absoluteModel({ startPos: [0, 0], pressClient: [0, 0], offset: [0, 0], scale: 1 });
  // the real pointer is not at the edge, but the delivered (snapped) one is: the frontend auto-pans
  m.step({ real: [0, 10], offset: [0, 0], scale: 1 }, (p) => p, true);
  m.markShiftsStart(true);
  const out = m.step({ real: [0, 10], offset: [0, -9], scale: 1 }, (p) => p, false);
  assert.deepEqual(out.raw, [0, 19]);
});

test("the auto-pan band is the 50 px along each side of the canvas", () => {
  const bounds = { left: 100, top: 50, right: 900, bottom: 650 };
  assert.equal(AUTO_PAN_EDGE_PX, 50);
  assert.equal(inAutoPanBand([500, 300], bounds), false);
  assert.equal(inAutoPanBand([149, 300], bounds), true); // left
  assert.equal(inAutoPanBand([150, 300], bounds), false); // exactly 50 in is outside the band
  assert.equal(inAutoPanBand([851, 300], bounds), true); // right
  assert.equal(inAutoPanBand([500, 99], bounds), true); // top
  assert.equal(inAutoPanBand([500, 601], bounds), true); // bottom
  assert.equal(inAutoPanBand([50, 300], bounds), true); // outside the canvas counts too
});
