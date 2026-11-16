// Group corner handles, shaped like a Nodes 2.0 node's resize handles (frontend 1.58.5,
// resizeHandleConfig.ts / LGraphNode.vue): a 20 x 20 square per corner reaching 4 outside the
// box and 16 inside, and a grip of two diagonal strokes in the inner 8 x 8. Canvas units, so it
// scales with the zoom like the node handles do. Pure.

export const HANDLE_OUTSIDE = 4;
export const HANDLE_INSIDE = 16;

/**
 * Which corner of rect the point is on, or null. The inside part is capped at a quarter of
 * the box so a small group keeps some title to grab.
 */
export function cornerAt(rect, x, y) {
  const inside = Math.min(HANDLE_INSIDE, rect.w / 4, rect.h / 4);
  const near = (v, edge, dir) => {
    const d = (v - edge) * dir; // >= 0 inside the box
    return d >= -HANDLE_OUTSIDE && d <= inside;
  };
  const v = near(y, rect.y, 1) ? "N" : near(y, rect.y + rect.h, -1) ? "S" : "";
  const h = near(x, rect.x, 1) ? "W" : near(x, rect.x + rect.w, -1) ? "E" : "";
  return v && h ? v + h : null;
}

/**
 * The grip strokes for a corner, as line segments [[x1, y1, x2, y2], ...] in canvas units.
 * The node handle draws "M11 1L1 11M11 6L6 11" (12 x 12 view box) in an 8 x 8 square whose outer
 * sides sit 4 inside the corner, mirrored per corner.
 */
export function gripSegments(rect, corner) {
  const k = 8 / 12;
  const east = corner.includes("E");
  const south = corner.includes("S");
  // the 8 x 8 square, outer sides 4 inside the corner
  const x0 = east ? rect.x + rect.w - 4 - 8 : rect.x + 4;
  const y0 = south ? rect.y + rect.h - 4 - 8 : rect.y + 4;
  const map = (px, py) => [x0 + (east ? px : 12 - px) * k, y0 + (south ? py : 12 - py) * k];
  return [[11, 1, 1, 11], [11, 6, 6, 11]].map(([a, b, c, d]) => [...map(a, b), ...map(c, d)]);
}
