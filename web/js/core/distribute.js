// Distribute ("Space columns / rows evenly") and its gap handles. See docs/spec.md 3.5 and 3.6.
// Pure: boxes are { id, x, y, w, h, head?, pinned? } in canvas units (visual box; head is the
// header height).
//
// Lanes are columns for axis "x" and rows for axis "y". Along the axis a lane has
//   S: its start, the smallest left edge (rows: the smallest body top, as "Align top" measures)
//   box start / end: the extent of its boxes
// The gap between two lanes is the next lane's box start minus the lane's box end (negative when
// they overlap). Placing lanes with gap g: S[i+1] = S[i] + max(0, L[i] + g), where
// L[i] = (box end of lane i) - S[i] - (box start of lane i+1 - S[i+1]) is the gap-free distance
// from one start to the next. The max keeps a lane from passing the start of the lane before:
// it stops level with it ("a lane squeezed all the way stops").

const TOL = 0.5;
const LANE_TOL = 20; // canvas units, from the playground
const MIN_HANDLE_PX = 10; // screen px between a handle and the next lane's start when the gap is small
const HANDLE_SPAN = 600; // past this length across, a handle sits this far into its node, not at the center

const lenOf = (axis) => (axis === "x" ? "w" : "h");
const crossOf = (axis) => (axis === "x" ? "y" : "x");
const bodyStart = (b, axis) => b[axis] + (axis === "y" ? b.head ?? 0 : 0);
const boxEnd = (b, axis) => b[axis] + b[lenOf(axis)];

/** Whether two boxes share a lane: start, center or end within LANE_TOL, or one's extent inside the other's. */
function sameLane(p, q, axis) {
  const len = lenOf(axis);
  const p0 = p[axis], p1 = p0 + p[len], q0 = q[axis], q1 = q0 + q[len];
  if (Math.abs(bodyStart(p, axis) - bodyStart(q, axis)) <= LANE_TOL) return true;
  if (Math.abs(p1 - q1) <= LANE_TOL || Math.abs((p0 + p1) / 2 - (q0 + q1) / 2) <= LANE_TOL) return true;
  return (p0 >= q0 - TOL && p1 <= q1 + TOL) || (q0 >= p0 - TOL && q1 <= p1 + TOL);
}

/** Groups boxes into lanes along the axis; membership chains. Unordered. */
export function lanes(boxes, axis) {
  const parent = boxes.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (sameLane(boxes[i], boxes[j], axis)) parent[find(i)] = find(j);
    }
  }
  const groups = new Map();
  boxes.forEach((b, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(b);
  });
  return [...groups.values()];
}

/** A lane's measures along the axis. */
function measure(lane, axis) {
  const S = Math.min(...lane.map((b) => bodyStart(b, axis)));
  const start = Math.min(...lane.map((b) => b[axis]));
  const end = Math.max(...lane.map((b) => boxEnd(b, axis)));
  return { S, start, end, off: start - S, len: end - start };
}

/** Lanes in order of their start, with pinned lanes left out (they do not move). */
function orderedLanes(boxes, axis) {
  const all = lanes(boxes, axis);
  const movable = all.filter((l) => !l.some((b) => b.pinned));
  return { lanes: movable.sort((p, q) => measure(p, axis).S - measure(q, axis).S), count: all.length, pinned: all.length - movable.length };
}

/** The gap-free start-to-start distances L[i] of ordered lanes (see the top of this file). */
function pairLengths(ms) {
  const out = [];
  for (let i = 0; i + 1 < ms.length; i++) out.push(ms[i].off + ms[i].len - ms[i + 1].off);
  return out;
}

const startsForward = (S0, L, g) => {
  const S = [S0];
  for (let i = 0; i < L.length; i++) S.push(S[i] + Math.max(0, L[i] + g));
  return S;
};
const startsBackward = (Slast, L, g) => {
  const S = new Array(L.length + 1);
  S[L.length] = Slast;
  for (let i = L.length - 1; i >= 0; i--) S[i] = S[i + 1] - Math.max(0, L[i] + g);
  return S;
};
const totalSpan = (L, g) => L.reduce((t, l) => t + Math.max(0, l + g), 0);

/** The smallest gap: every lane level with the one before (all starts aligned). */
const minGap = (L) => -Math.max(...L);

/**
 * Solves a nondecreasing function f(g) = target for g in [lo, hi] by bisection; returns the
 * largest such g when f is flat there.
 */
function solve(f, target, lo, hi) {
  if (f(lo) >= target) return lo;
  while (f(hi) < target) hi += Math.max(1, Math.abs(hi));
  for (let k = 0; k < 100; k++) {
    const mid = (lo + hi) / 2;
    if (f(mid) <= target) lo = mid; else hi = mid;
  }
  return lo;
}

/**
 * The plan for the boxes: { lanes, g } with the lanes in order and the gap that puts the last
 * lane's end where it is, or { na } with fewer than three lanes.
 */
export function plan(boxes, axis) {
  const { lanes: ls, count } = orderedLanes(boxes, axis);
  if (ls.length < 3) return { na: { code: axis === "x" ? "needColumns" : "needRows", count } };
  return { lanes: ls, g: gapFor(ls, axis) };
}

/** The gap with which the first lane's start and the last lane's start stay where they are. */
function gapFor(ls, axis) {
  const ms = ls.map((l) => measure(l, axis));
  const L = pairLengths(ms);
  const target = ms[ms.length - 1].S - ms[0].S;
  const lo = minGap(L);
  if (target <= 0) return lo; // all starts level already: squeezed all the way
  return solve((g) => totalSpan(L, g), target, lo, Math.max(...L.map((l) => Math.abs(l))) + target + 1);
}

/** Changes ({ id, x, y }) that move each lane so that lane i starts at S[i]. */
function moveLanes(ls, axis, S) {
  const out = [];
  ls.forEach((lane, i) => {
    const d = S[i] - measure(lane, axis).S;
    if (Math.abs(d) < 1e-9) return;
    for (const b of lane) {
      if (b.pinned) continue;
      out.push({ id: b.id, x: b.x + (axis === "x" ? d : 0), y: b.y + (axis === "y" ? d : 0) });
    }
  });
  return out;
}

/** The changes a press makes: lanes placed with the solved gap from the first lane's start. */
function pressChanges(ls, axis, g) {
  const ms = ls.map((l) => measure(l, axis));
  return moveLanes(ls, axis, startsForward(ms[0].S, pairLengths(ms), g));
}

/** Changes for pressing distribute on the boxes (empty when not applicable). */
export function distribute(boxes, axis) {
  const p = plan(boxes, axis);
  return p.na ? [] : pressChanges(p.lanes, axis, p.g);
}

const movesNothing = (changes, boxes) => {
  const byId = new Map(boxes.map((b) => [b.id, b]));
  return changes.every((c) => Math.abs(c.x - byId.get(c.id).x) <= TOL && Math.abs(c.y - byId.get(c.id).y) <= TOL);
};

/** { state: 'ok' | 'done' | 'na', reason } for the distribute button. Done when a press moves nothing. */
export function distributeState(boxes, axis) {
  const p = plan(boxes, axis);
  if (p.na) return { state: "na", reason: p.na };
  return movesNothing(pressChanges(p.lanes, axis, p.g), boxes) ? { state: "done", reason: { code: "distributed" } } : { state: "ok", reason: null };
}

// ----- handle sessions -----

/**
 * A handle session after a press: { axis, lanes, g, cross }. lanes hold box ids in their order,
 * kept while the handles are shown (not re-detected); boxes are read live through `live`
 * (id -> box). g is the gap now; cross the place of each handle across the axis.
 */
export function startSession(boxes, axis) {
  const p = plan(boxes, axis);
  if (p.na) return null;
  const placed = applyChanges(boxes, pressChanges(p.lanes, axis, p.g));
  const byId = new Map(placed.map((b) => [b.id, b]));
  const session = { axis, lanes: p.lanes.map((l) => l.map((b) => b.id)), g: p.g, cross: [] };
  session.cross = crossSpots(session, byId);
  return session;
}

const liveLanes = (session, live) => session.lanes.map((ids) => ids.map((id) => live.get(id)).filter(Boolean));

/** Whether the session still applies: every box is there. */
export function sessionValid(session, live) {
  return session.lanes.every((ids) => ids.every((id) => live.has(id)));
}

/** The session's state: done when pressing (with the session's lanes) would move nothing. */
export function sessionState(session, live) {
  const ls = liveLanes(session, live);
  const changes = pressChanges(ls, session.axis, gapFor(ls, session.axis));
  return movesNothing(changes, ls.flat()) ? { state: "done", reason: { code: "distributed" } } : { state: "ok", reason: null };
}

/** Changes for pressing with the session's lanes; also updates session.g. */
export function sessionPress(session, live) {
  const ls = liveLanes(session, live);
  session.g = gapFor(ls, session.axis);
  return pressChanges(ls, session.axis, session.g);
}

/** The gaps between the session's lanes in order: { index, from, to, size } (size may be negative). */
export function sessionGaps(session, live) {
  const ms = liveLanes(session, live).map((l) => measure(l, session.axis));
  const out = [];
  for (let i = 0; i + 1 < ms.length; i++) out.push({ index: i, from: ms[i].end, to: ms[i + 1].start, size: ms[i + 1].start - ms[i].end });
  return out;
}

/**
 * Where each handle stands across the axis, decided now: in the middle of the selection for a
 * positive gap; for a gap of 0 or less, on the next lane's first node (smallest start; ties: first
 * across), at its center or HANDLE_SPAN/2 in.
 */
export function crossSpots(session, live) {
  const a = session.axis;
  const c = crossOf(a);
  const lc = lenOf(c);
  const ls = liveLanes(session, live);
  const all = ls.flat();
  const mid = (Math.min(...all.map((b) => b[c])) + Math.max(...all.map((b) => b[c] + b[lc]))) / 2;
  return sessionGaps(session, live).map((gap) => {
    if (gap.size > 0) return mid;
    const first = ls[gap.index + 1].reduce((f, b) => (bodyStart(b, a) < bodyStart(f, a) || (bodyStart(b, a) === bodyStart(f, a) && b[c] < f[c]) ? b : f));
    return first[c] + Math.min(first[lc], HANDLE_SPAN) / 2;
  });
}

/** Along the axis: the next lane's start minus half the gap, at least MIN_HANDLE_PX on screen. */
const alongOf = (gapSize, nextStart, px) => nextStart - Math.max(gapSize / 2, MIN_HANDLE_PX * px);

/** Where each handle stands: [{ along, cross }] (px: one screen pixel in canvas units). */
export function handleSpots(session, live, px) {
  return sessionGaps(session, live).map((gap, i) => ({ along: alongOf(gap.size, gap.to, px), cross: session.cross[i] }));
}

/**
 * Dragging handle `index` from startPointer to pointer (along the axis). Returns { changes, g }.
 * The far end stays: a handle past the middle keeps the first lane's start, one before it keeps
 * the last lane's end, the middle handle (odd number of gaps) keeps the middle of the two and
 * changes the whole length by twice the pointer's travel. The handle follows the pointer; where
 * it cannot (the lanes it depends on are squeezed all the way), the gap keeps following the
 * pointer's travel, so every handle can squeeze all the way. Never below all starts level.
 */
export function handleDrag(session, live, index, pointer, startPointer, px) {
  const a = session.axis;
  const ls = liveLanes(session, live);
  const ms = ls.map((l) => measure(l, a));
  const L = pairLengths(ms);
  const n = L.length;
  const g0 = session.g;
  const gMin = minGap(L);
  const middle = (n - 1) / 2;
  const S0 = ms[0].S;
  const Slast = ms[n].S;
  let starts;
  let g;
  if (index === middle) {
    // keep the middle of the first start and the last end; total length grows by twice the travel
    const fixed = ms[0].off - (ms[n].off + ms[n].len);
    const span = (gg) => totalSpan(L, gg) - fixed;
    const center = (ms[0].start + ms[n].end) / 2;
    const want = span(g0) + 2 * (pointer - startPointer);
    g = want <= span(gMin) ? gMin : solve(span, want, gMin, g0 + Math.abs(pointer - startPointer) + 1);
    const S0new = center - span(g) / 2 - ms[0].off;
    starts = startsForward(S0new, L, g);
  } else {
    const forward = index > middle;
    const place = (gg) => (forward ? startsForward(S0, L, gg) : startsBackward(Slast, L, gg));
    // the handle's position as a function of the gap, made strictly monotone: where the handle
    // stops moving (lanes squeezed all the way), extend it 1:1 with the gap
    const handleAt = (gg) => {
      const S = place(gg);
      const size = Math.max(0, L[index] + gg) - L[index];
      return alongOf(size, S[index + 1] + ms[index + 1].off, px);
    };
    // forward, the handle depends on L[0..index]; backward, on L[index..n-1]
    const gFlat = Math.max(forward ? -Math.max(...L.slice(0, index + 1)) : -Math.max(...L.slice(index)), gMin);
    const sign = forward ? 1 : -1; // forward: the handle moves with the gap; backward: against it
    const u = (gg) => (gg >= gFlat ? sign * handleAt(gg) : sign * handleAt(gFlat) - (gFlat - gg));
    const want = u(g0) + sign * (pointer - startPointer);
    g = want <= u(gMin) ? gMin : solve(u, want, gMin, g0 + Math.abs(pointer - startPointer) + 1);
    starts = place(g);
  }
  return { changes: moveLanes(ls, a, starts), g };
}

/** Returns copies of boxes with the changes applied. */
function applyChanges(boxes, changes) {
  const byId = new Map(changes.map((c) => [c.id, c]));
  return boxes.map((b) => (byId.has(b.id) ? { ...b, ...byId.get(b.id) } : { ...b }));
}

/** The box around a group of boxes, as { x0, y0, x1, y1 }. */
export function boundsOf(group) {
  return {
    x0: Math.min(...group.map((b) => b.x)), y0: Math.min(...group.map((b) => b.y)),
    x1: Math.max(...group.map((b) => b.x + b.w)), y1: Math.max(...group.map((b) => b.y + b.h)),
  };
}

/** The session's lanes as live boxes (for outlines). */
export function sessionLanes(session, live) {
  return liveLanes(session, live);
}
