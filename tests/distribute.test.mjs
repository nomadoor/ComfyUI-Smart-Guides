import { test } from "node:test";
import assert from "node:assert/strict";
import { lanes, distribute, distributeState, startSession, sessionGaps, sessionState, sessionPress, handleSpots, handleDrag, crossSpots } from "../web/js/core/distribute.mjs";

const box = (id, x, y, w, h, extra = {}) => ({ id, x, y, w, h, ...extra });
const apply = (boxes, changes) => {
  const m = new Map(changes.map((c) => [c.id, c]));
  return boxes.map((b) => ({ ...b, ...(m.get(b.id) ?? {}) }));
};
const live = (boxes) => new Map(boxes.map((b) => [b.id, b]));
const ids = (ls) => ls.map((l) => l.map((b) => b.id).sort().join("+")).sort();
const gaps = (boxes, axis) => {
  const s = startSession(boxes, axis);
  return sessionGaps(s, live(boxes)).map((g) => Math.round(g.size * 1000) / 1000);
};

// ----- lanes (3.5) -----

test("lanes: aligned start, center or end within 20, or one inside the other; chaining; not by partial overlap", () => {
  const a = box("a", 0, 0, 200, 50);
  const b = box("b", 15, 100, 100, 50); // left edges within 20
  const c = box("c", 300, 0, 100, 50);
  const d = box("d", 330, 100, 200, 50); // overlaps c by 70 of 200: not joined
  const e = box("e", 302, 200, 18, 50); // inside c's extent, not lined up with d
  assert.deepEqual(ids(lanes([a, b, c, d, e], "x")), ["a+b", "c+e", "d"]);
});

test("rows: body tops level count as one row (a Reroute top-aligned to a node)", () => {
  const node = box("n", 0, 0, 200, 300, { head: 30 });
  const reroute = box("r", 300, 30, 75, 26, { head: 0 });
  assert.deepEqual(ids(lanes([node, reroute], "y")), ["n+r"]);
});

test("rows: a tall node beside a stack of small ones is one row (they are inside its extent)", () => {
  const items = [box("A", 0, 0, 300, 500), box("B", 400, 40, 300, 100), box("C", 400, 170, 300, 100), box("D", 400, 330, 300, 100)];
  assert.deepEqual(distributeState(items, "y").reason, { code: "needRows", count: 1 });
});

// ----- press (3.5) -----

test("columns spaced evenly, the first start and the last end stay", () => {
  const items = [box("a", 0, 0, 100, 50), box("b", 150, 0, 100, 50), box("c", 500, 0, 100, 50)];
  const after = apply(items, distribute(items, "x"));
  assert.deepEqual(after.map((b) => b.x), [0, 250, 500]);
  assert.equal(distributeState(after, "x").state, "done");
});

test("whole columns move together", () => {
  const items = [box("a", 0, 0, 100, 50), box("a2", 0, 100, 100, 50), box("b", 150, 0, 100, 50), box("b2", 150, 100, 100, 50), box("c", 500, 0, 100, 50)];
  const after = apply(items, distribute(items, "x"));
  assert.deepEqual(after.map((b) => b.x), [0, 0, 250, 250, 500]);
});

test("fewer than three lanes: not applicable", () => {
  const items = [box("a", 0, 0, 100, 50), box("b", 0, 100, 100, 50)];
  assert.deepEqual(distributeState(items, "x"), { state: "na", reason: { code: "needColumns", count: 1 } });
  assert.deepEqual(distributeState(items, "y"), { state: "na", reason: { code: "needRows", count: 2 } });
});

test("overlapping lanes get equal negative gaps (owner's staircase of image loaders)", () => {
  const items = [box("a", 0, 0, 260, 390), box("b", 310, 40, 260, 390), box("c", 620, 130, 260, 390), box("d", 930, 160, 260, 390)];
  const after = apply(items, distribute(items, "y"));
  assert.deepEqual(after.map((b) => Math.round(b.y * 100) / 100), [0, 53.33, 106.67, 160]);
  assert.deepEqual(gaps(after, "y"), [-336.667, -336.667, -336.667]);
  assert.equal(distributeState(after, "y").state, "done");
});

test("rows that overlap a little: equal negative gaps; a top-aligned row moves as one", () => {
  const b = (id, x, y) => box(id, x, y, 162, 242, { head: 16 });
  const items = [b("front", 141, 58), b("back", 321, 58), b("right", 649, 280), b("left", 345, 530)];
  const after = apply(items, distribute(items, "y"));
  assert.deepEqual(after.map((x) => x.y), [58, 58, 294, 530]);
  assert.deepEqual(gaps(after, "y"), [-6, -6]);
});

test("a lane squeezed all the way stops level with the one before; order never flips", () => {
  // tall A beside short B and C below each other: equal gaps would put B below C
  const items = [box("A", 0, 0, 300, 300), box("B", 400, 330, 300, 100), box("C", 800, 450, 300, 100)];
  const after = apply(items, distribute(items, "y"));
  const y = Object.fromEntries(after.map((b) => [b.id, b.y]));
  assert.ok(y.A <= y.B && y.B <= y.C);
  assert.equal(distributeState(after, "y").state, "done");
});

test("any layout can be pressed: overlapping, pinned or many", () => {
  const items = [box("a", 0, 0, 260, 390), box("b", 310, 30, 260, 390, { pinned: true }), box("c", 620, 120, 260, 390), box("d", 930, 150, 260, 390)];
  const st = distributeState(items, "y");
  assert.notEqual(st.state, "na");
  const after = apply(items, distribute(items, "y"));
  assert.equal(after[1].y, 30); // pinned stays
  assert.equal(distributeState(after, "y").state, "done"); // a second press moves nothing
});

test("done means a press moves nothing", () => {
  const items = [box("a", 0, 0, 100, 50), box("b", 150, 0, 100, 50), box("c", 300, 0, 100, 50)];
  assert.equal(distributeState(items, "x").state, "done");
  assert.deepEqual(distribute(items, "x").filter((c) => Math.abs(c.x - items.find((b) => b.id === c.id).x) > 0.5), []);
});

// ----- session and handles (3.6) -----

test("the session keeps its lanes: squeezed all the way, it is done; re-detected it is one row", () => {
  const items = [box("a", 0, 0, 100, 100), box("b", 0, 200, 100, 100), box("c", 0, 400, 100, 100)];
  const s = startSession(items, "y");
  const L = live(items);
  const r = handleDrag(s, L, 1, -10000, 0, 1);
  const after = apply(items, r.changes);
  assert.deepEqual(after.map((b) => b.y), [0, 0, 0]); // all top-aligned
  assert.equal(sessionState(s, live(after)).state, "done"); // the first and the last start stay: nothing to press
  assert.deepEqual(distributeState(after, "y").reason, { code: "needRows", count: 1 }); // re-detected: one row
});

test("handle drags go from positive into negative and stop when every start is level", () => {
  const items = [box("a", 0, 0, 100, 100), box("b", 0, 200, 100, 100), box("c", 0, 400, 100, 100), box("d", 0, 600, 100, 100)];
  const s = startSession(items, "y");
  const L = live(items);
  // the last handle (past the middle) keeps the top
  const half = apply(items, handleDrag(s, L, 2, 450, 590, 1).changes);
  assert.equal(half[0].y, 0);
  assert.ok(half[3].y < 600);
  const neg = apply(items, handleDrag(s, L, 2, 250, 590, 1).changes);
  assert.ok(neg[1].y - (neg[0].y + 100) < 0); // negative gaps
  const all = apply(items, handleDrag(s, L, 2, -5000, 590, 1).changes);
  assert.deepEqual(all.map((b) => b.y), [0, 0, 0, 0]);
});

test("taking a handle without moving it moves nothing", () => {
  const items = [box("a", 0, 0, 260, 390), box("b", 310, 40, 260, 390), box("c", 620, 130, 260, 390), box("d", 930, 160, 260, 390)];
  const after = apply(items, distribute(items, "y"));
  const s = startSession(items, "y");
  const L = live(after);
  for (let i = 0; i < 3; i++) {
    const spot = handleSpots(s, L, 1)[i];
    const r = handleDrag(s, L, i, spot.along, spot.along, 1);
    assert.deepEqual(r.changes.filter((c) => Math.abs(c.y - L.get(c.id).y) > 1e-6), []);
  }
});

test("every handle can squeeze all the way, also when it stops moving first", () => {
  // lengths 100, 100, 100, 300, 100 in a column
  const hs = [100, 100, 100, 300, 100];
  let y = 0;
  const items = hs.map((h, i) => { const b = box("n" + i, 0, y, 100, h); y += h + 50; return b; });
  const s = startSession(items, "y");
  const L = live(items);
  for (let i = 0; i < 4; i++) {
    const spot = handleSpots(s, L, 1)[i];
    const r = handleDrag(s, L, i, spot.along + (i >= 2 ? -100000 : 100000), spot.along, 1);
    const after = apply(items, r.changes);
    const tops = after.map((b) => b.y);
    assert.ok(Math.max(...tops) - Math.min(...tops) < 1e-6, `handle ${i}: ${tops}`);
  }
});

test("the middle handle keeps the middle", () => {
  const items = [box("a", 0, 0, 100, 100), box("b", 0, 200, 100, 100), box("c", 0, 400, 100, 100), box("d", 0, 600, 100, 100)];
  const s = startSession(items, "y");
  const L = live(items);
  const r = apply(items, handleDrag(s, L, 1, 400, 350, 1).changes); // +50 -> length +100
  assert.equal(r[0].y, -50);
  assert.equal(r[3].y + 100, 750);
});

test("handle places: in the gap middle when open, 10 px before the next start otherwise, on its first node", () => {
  const open = [box("a", 0, 0, 100, 100), box("b", 0, 200, 100, 100), box("c", 0, 400, 100, 100)];
  const s1 = startSession(open, "y");
  assert.deepEqual(handleSpots(s1, live(open), 1), [{ along: 150, cross: 50 }, { along: 350, cross: 50 }]);
  const stairs = [box("a", 0, 0, 260, 390), box("b", 310, 50, 260, 390), box("c", 620, 100, 260, 390)];
  const s2 = startSession(stairs, "y");
  assert.deepEqual(handleSpots(s2, live(stairs), 1), [{ along: 40, cross: 440 }, { along: 90, cross: 750 }]);
});

test("pressing again in a session uses its lanes", () => {
  const items = [box("a", 0, 0, 100, 100), box("b", 0, 200, 100, 100), box("c", 0, 600, 100, 100)];
  const s = startSession(items, "y");
  const moved = apply(items, sessionPress(s, live(items)));
  assert.deepEqual(moved.map((b) => b.y), [0, 300, 600]);
  assert.equal(sessionState(s, live(moved)).state, "done");
  assert.equal(crossSpots(s, live(moved)).length, 2);
});
