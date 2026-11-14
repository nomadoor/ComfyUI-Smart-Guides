// Align / match-size / distribute for the menu, and the state of each button.
// Distribute (columns / rows spaced evenly) lives in ./distribute.mjs.
// Pure: boxes are { id, x, y, w, h, head?, pinned?, fixedSize? } in canvas units (visual box;
// head is the header height). Top alignment and match height use the body (header excluded).
// Results are lists of changes: { id, x, y } for moves, { id, w } or { id, h } for sizes.
// Results are not rounded.

import { distribute, distributeState } from "./distribute.mjs";

const TOL = 0.5;
const DISTRIBUTE_AXIS = { distX: "x", distY: "y" };

/** True for the two distribute actions (the ones that offer handles). */
export const isDistribute = (action) => action in DISTRIBUTE_AXIS;

/** The axis a distribute action works along ("x" or "y"). */
export const distributeAxis = (action) => DISTRIBUTE_AXIS[action];

const same = (values) => values.length > 1 && Math.max(...values) - Math.min(...values) <= TOL;
// sizes compared by match width / match height: the width, and the height of the body
const sizeOf = (b, key) => (key === "w" ? b.w : b.h - (b.head ?? 0));

const startOf = (group, axis) => Math.min(...group.map((b) => b[axis]));
const endOf = (group, axis) => Math.max(...group.map((b) => b[axis] + (axis === "x" ? b.w : b.h)));

function moveChanges(boxes, delta) {
  const out = [];
  for (const b of boxes) {
    const d = delta(b);
    if (b.pinned || (Math.abs(d.x) < 1e-9 && Math.abs(d.y) < 1e-9)) continue;
    out.push({ id: b.id, x: b.x + d.x, y: b.y + d.y });
  }
  return out;
}

const ALIGN = {
  left: { axis: "x", value: (b) => b.x, target: (v) => Math.min(...v) },
  right: { axis: "x", value: (b) => b.x + b.w, target: (v) => Math.max(...v) },
  hcenter: { axis: "x", value: (b) => b.x + b.w / 2, target: null },
  top: { axis: "y", value: (b) => b.y + (b.head ?? 0), target: (v) => Math.min(...v) },
  bottom: { axis: "y", value: (b) => b.y + b.h, target: (v) => Math.max(...v) },
  vcenter: { axis: "y", value: (b) => b.y + b.h / 2, target: null },
};

function alignTarget(boxes, kind) {
  const a = ALIGN[kind];
  if (a.target) return a.target(boxes.map(a.value));
  return (startOf(boxes, a.axis) + endOf(boxes, a.axis)) / 2;
}

/** Applies one menu action. Returns the changes. */
export function runAction(boxes, action) {
  if (ALIGN[action]) {
    const a = ALIGN[action];
    const t = alignTarget(boxes, action);
    return moveChanges(boxes, (b) => (a.axis === "x" ? { x: t - a.value(b), y: 0 } : { x: 0, y: t - a.value(b) }));
  }
  if (action === "width" || action === "height") {
    const key = action === "width" ? "w" : "h";
    const sizable = boxes.filter((b) => !b.fixedSize);
    const max = Math.max(...sizable.map((b) => sizeOf(b, key)));
    return sizable
      .filter((b) => Math.abs(sizeOf(b, key) - max) > 1e-9)
      .map((b) => ({ id: b.id, [key]: key === "w" ? max : max + (b.head ?? 0) }));
  }
  if (isDistribute(action)) return distribute(boxes, DISTRIBUTE_AXIS[action]);
  throw new Error(`unknown action ${action}`);
}

/**
 * State of a menu button: { state: 'ok' | 'done' | 'na', reason: { code, count? } | null }.
 */
export function buttonState(boxes, action) {
  if (boxes.length < 2) return { state: "na", reason: { code: "needTwo" } };
  if (ALIGN[action]) {
    return same(boxes.map(ALIGN[action].value)) ? { state: "done", reason: { code: "aligned" } } : { state: "ok", reason: null };
  }
  if (action === "width" || action === "height") {
    const key = action === "width" ? "w" : "h";
    const sizable = boxes.filter((b) => !b.fixedSize);
    if (sizable.length < 2) return { state: "na", reason: { code: "needTwoSizable" } };
    return same(sizable.map((b) => sizeOf(b, key))) ? { state: "done", reason: { code: "sameSize" } } : { state: "ok", reason: null };
  }
  if (isDistribute(action)) return distributeState(boxes, DISTRIBUTE_AXIS[action]);
  throw new Error(`unknown action ${action}`);
}
