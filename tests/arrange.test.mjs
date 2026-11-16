import { test } from "node:test";
import assert from "node:assert/strict";
import { runAction, buttonState, isDistribute } from "../web/js/core/arrange.js";

const box = (id, x, y, w, h, extra = {}) => ({ id, x, y, w, h, ...extra });
const byId = (changes) => Object.fromEntries(changes.map((c) => [c.id, c]));

test("align left moves every box to the leftmost left edge; done when within 0.5", () => {
  const items = [box("a", 10, 0, 100, 50), box("b", 40, 100, 60, 50)];
  assert.deepEqual(byId(runAction(items, "left")).b, { id: "b", x: 10, y: 100 });
  assert.equal(buttonState(items, "left").state, "ok");
  assert.equal(buttonState([box("a", 10, 0, 100, 50), box("b", 10.4, 100, 60, 50)], "left").state, "done");
});

test("align centers and right/bottom", () => {
  const items = [box("a", 0, 0, 100, 50), box("b", 200, 100, 50, 30)];
  const hc = byId(runAction(items, "hcenter")); // bbox 0..250, center 125
  assert.equal(hc.a.x, 75);
  assert.equal(hc.b.x, 100);
  const r = byId(runAction(items, "right"));
  assert.equal(r.a.x, 150);
  const bo = byId(runAction(items, "bottom")); // max bottom 130
  assert.equal(bo.a.y, 80);
});

test("pinned boxes stay but count for the target and the state", () => {
  const items = [box("a", 10, 0, 100, 50, { pinned: true }), box("b", 0, 100, 60, 50)];
  const ch = byId(runAction(items, "right")); // max right 110 (pinned a)
  assert.equal(ch.a, undefined);
  assert.equal(ch.b.x, 50);
});

test("match width and height to the largest, skipping fixed-size boxes", () => {
  const items = [box("a", 0, 0, 100, 50), box("b", 0, 100, 60, 80), box("r", 0, 300, 20, 20, { fixedSize: true })];
  const w = byId(runAction(items, "width"));
  assert.equal(w.b.w, 100);
  assert.equal(w.r, undefined);
  const h = byId(runAction(items, "height"));
  assert.equal(h.a.h, 80);
  assert.equal(buttonState([box("a", 0, 0, 10, 10), box("r", 0, 0, 20, 20, { fixedSize: true })], "width").state, "na");
});





test("align top uses the top of the body, so a reroute lines up with a node's body", () => {
  const items = [box("v", 100, 70, 140, 76, { head: 30 }), box("r", 400, 130, 75, 26, { head: 0 })];
  const ch = Object.fromEntries(runAction(items, "top").map((c) => [c.id, c]));
  assert.equal(ch.r.y, 100);
  assert.equal(ch.v, undefined);
  assert.equal(buttonState([box("v", 100, 70, 140, 76, { head: 30 }), box("r", 400, 100, 75, 26, { head: 0 })], "top").state, "done");
});

test("match height matches the bodies (headers excluded)", () => {
  // a headed node (body 46) and a headless one (body 26): the headless one grows to body 46
  const items = [box("v", 0, 70, 140, 76, { head: 30 }), box("r", 200, 100, 75, 26, { head: 0 })];
  const ch = Object.fromEntries(runAction(items, "height").map((c) => [c.id, c]));
  assert.equal(ch.r.h, 46);
  assert.equal(ch.v, undefined);
  assert.equal(buttonState([box("v", 0, 70, 140, 76, { head: 30 }), box("r", 200, 100, 75, 46, { head: 0 })], "height").state, "done");
});

test("only the two distribute actions offer handles", () => {
  assert.equal(isDistribute("distX"), true);
  assert.equal(isDistribute("distY"), true);
  assert.equal(isDistribute("left"), false);
});

