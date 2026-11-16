import { test } from "node:test";
import assert from "node:assert/strict";
import { placePopover } from "../web/js/core/popover.js";

const box = (left, top, width, height) => ({ left, top, width, height, bottom: top + height });
const menu = box(0, 0, 200, 80);

test("above the toolbox, centered on the button, with the arrow at the button's center", () => {
  const bar = box(300, 400, 400, 40);
  const button = box(600, 404, 32, 32);
  assert.deepEqual(placePopover({ button, bar, menu, viewportWidth: 1200, preferAbove: true }), { left: 516, top: 315, above: true, arrowX: 100 });
});

test("below the toolbox when there is no room above", () => {
  const bar = box(300, 60, 400, 40);
  const button = box(600, 64, 32, 32);
  const p = placePopover({ button, bar, menu, viewportWidth: 1200, preferAbove: true });
  assert.equal(p.above, false);
  assert.equal(p.top, 105); // under the bar, not under the button
});

test("below the button when it is not on a toolbox", () => {
  const button = box(1100, 10, 32, 32);
  const p = placePopover({ button, bar: button, menu, viewportWidth: 1200, preferAbove: false });
  assert.equal(p.above, false);
  assert.equal(p.top, 47);
});

test("kept inside the viewport sideways; the arrow still points at the button", () => {
  const right = placePopover({ button: box(1150, 10, 32, 32), bar: box(1150, 10, 32, 32), menu, viewportWidth: 1200, preferAbove: false });
  assert.equal(right.left, 990);
  assert.equal(right.arrowX, 176);
  const leftEdge = placePopover({ button: box(20, 300, 32, 32), bar: box(0, 296, 300, 40), menu, viewportWidth: 1200, preferAbove: true });
  assert.equal(leftEdge.left, 10);
  assert.equal(leftEdge.arrowX, 26);
});
