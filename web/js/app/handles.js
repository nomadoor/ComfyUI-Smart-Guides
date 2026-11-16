// The distribute handles (docs/spec.md 3.6): after a distribute, one handle per gap. Dragging any
// of them changes every gap by the same amount, from positive into negative (see handleDrag in
// ../core/distribute.js). While they are shown, lanes of two or more nodes are outlined, each
// gap shows its size, and the lanes found at the press are kept (not re-detected).

import { sessionGaps, sessionLanes, sessionValid, sessionState, sessionPress, handleSpots, handleDrag, boundsOf } from "../core/distribute.js";
import { accent, cachedCssVar } from "./accent.js";

export const HANDLE_CLASS = "smart-guides-handle";

const LABEL_OFFSET_PX = 24; // from the handle's center to its number's
const SAME_SPOT_PX = 3; // handles closer than this on screen show one number
const labelBackground = cachedCssVar("--comfy-menu-bg", "#1f1f1f");

/**
 * selection returns the selected nodes as boxes, selectionKey a string that changes when the
 * selection does; onDragEnd runs after a handle drag has ended.
 */
export function createDistributeHandles(env, overlay, { selection, selectionKey, onDragEnd }) {
  let shown = null; // { session, els, selKey, expect } while handles are on screen
  let endDrag = null; // closes an open handle drag (undo transaction and listeners)
  let tickRaf = 0;

  const liveBoxes = () => new Map(selection().map((b) => [b.id, b]));
  const sessionNodes = () => {
    const g = env.graph();
    return shown.session.lanes.flat().map((id) => g?.getNodeById(id) ?? g?.getNodeById(Number(id))).filter(Boolean);
  };
  // where the session's nodes are now, to notice moves made by anything but the press or the handles
  const remember = () => { shown.expect = new Map(sessionNodes().map((n) => [String(n.id), [n.pos[0], n.pos[1]]])); };

  /** Shows the handles of a session made at the press (core startSession), after its changes are applied. */
  function show(session) {
    stop();
    if (!session) return;
    const host = env.canvas()?.canvas?.parentElement;
    if (!host) return;
    const els = session.lanes.slice(1).map((_, i) => {
      const h = document.createElement("div");
      h.className = `${HANDLE_CLASS} sg-${session.axis}`;
      h.dataset.gap = String(i);
      h.style.zIndex = String(41 + i); // a later gap's handle is on top where handles meet
      h.addEventListener("pointerdown", (e) => beginDrag(e, i));
      host.append(h);
      return h;
    });
    shown = { session, els, selKey: selectionKey(), expect: null };
    remember();
    overlay.request();
    if (!tickRaf) tickRaf = requestAnimationFrame(tick);
  }

  function stop() {
    if (!shown) return;
    endDrag?.();
    for (const h of shown.els) h.remove();
    shown = null;
    overlay.request();
  }

  // Handles go away when the selection changes, after an undo (the graph is reloaded, so the
  // nodes are no longer the session's), and when a node is moved by anything but the handles.
  function valid() {
    if (!shown) return false;
    if (selectionKey() !== shown.selKey) return false;
    const nodes = sessionNodes();
    if (nodes.length !== shown.session.lanes.flat().length) return false;
    if (endDrag) return true; // our own drag moves them
    return nodes.every((n) => {
      const p = shown.expect?.get(String(n.id));
      return p && Math.abs(p[0] - n.pos[0]) <= 0.5 && Math.abs(p[1] - n.pos[1]) <= 0.5;
    });
  }

  /** The session for a distribute along `axis`, while its handles are shown. */
  function sessionFor(axis) {
    if (!shown || shown.session.axis !== axis || !valid()) return null;
    return shown.session;
  }

  /** The button state for the shown session (its lanes, not re-detected), or null. */
  function stateFor(axis) {
    const s = sessionFor(axis);
    if (!s) return null;
    const live = liveBoxes();
    return sessionValid(s, live) ? sessionState(s, live) : null;
  }

  /** Changes for pressing again while shown (the session's lanes); null when not shown. */
  function pressAgain(axis) {
    const s = sessionFor(axis);
    if (!s) return null;
    const live = liveBoxes();
    return sessionValid(s, live) ? sessionPress(s, live) : null;
  }

  /** After a press while shown: remember the positions. The handles' places across stay (3.6). */
  function afterPress() {
    if (!shown) return;
    remember();
  }

  const toScreen = (canvas, x, y) => {
    const { scale, offset } = canvas.ds;
    return [(x + offset[0]) * scale + canvas.canvas.offsetLeft, (y + offset[1]) * scale + canvas.canvas.offsetTop];
  };

  function place() {
    if (!shown) return;
    if (!valid()) { stop(); return; }
    const canvas = env.canvas();
    const live = liveBoxes();
    if (!sessionValid(shown.session, live)) { stop(); return; }
    const spots = handleSpots(shown.session, live, 1 / canvas.ds.scale);
    for (const h of shown.els) {
      const spot = spots[Number(h.dataset.gap)];
      if (!spot) continue;
      const [sx, sy] = shown.session.axis === "x" ? toScreen(canvas, spot.along, spot.cross) : toScreen(canvas, spot.cross, spot.along);
      h.style.left = `${sx}px`;
      h.style.top = `${sy}px`;
    }
  }

  function beginDrag(e, gapIndex) {
    if (!shown) return;
    e.preventDefault();
    e.stopPropagation();
    const h = e.currentTarget;
    h.setPointerCapture(e.pointerId);
    const canvas = env.canvas();
    const session = shown.session;
    const axis = session.axis;
    // boxes and node positions at the start; every move is computed from them
    const base = liveBoxes();
    const nodes = new Map(sessionNodes().map((n) => [String(n.id), n]));
    const pos0 = new Map([...nodes].map(([id, n]) => [id, [n.pos[0], n.pos[1]]]));
    const px = 1 / canvas.ds.scale; // the 10 px in canvas units, at the scale the drag began with
    let open = false; // an undo transaction is open
    try { canvas.emitBeforeChange?.(); open = true; } catch { /* ignore */ }
    const [sx, sy] = canvas.convertEventToCanvasOffset(e);
    const startValue = axis === "x" ? sx : sy;
    let g = session.g;
    const move = (ev) => {
      const [cx, cy] = canvas.convertEventToCanvasOffset(ev);
      const r = handleDrag(session, base, gapIndex, axis === "x" ? cx : cy, startValue, px);
      g = r.g;
      const changes = new Map(r.changes.map((c) => [c.id, c]));
      for (const [id, n] of nodes) {
        const b = base.get(id);
        const c = changes.get(id);
        const [x0, y0] = pos0.get(id);
        n.pos = c && b ? [x0 + (c.x - b.x), y0 + (c.y - b.y)] : [x0, y0];
      }
      canvas.setDirty(true, true);
      overlay.request();
    };
    const up = () => {
      h.removeEventListener("pointermove", move);
      h.removeEventListener("pointerup", up);
      h.removeEventListener("pointercancel", up);
      h.removeEventListener("lostpointercapture", up);
      endDrag = null;
      if (open) { open = false; try { canvas.emitAfterChange?.(); } catch { /* ignore */ } }
      if (shown?.session === session) {
        session.g = g;
        remember(); // the handles' places across stay as decided at the press (3.6)
      }
      onDragEnd();
    };
    endDrag = up;
    h.addEventListener("pointermove", move);
    h.addEventListener("pointerup", up);
    h.addEventListener("pointercancel", up);
    h.addEventListener("lostpointercapture", up);
  }

  /** Overlay job: lane outlines and the size of each gap while handles are shown. */
  function draw(ctx, px) {
    if (!shown) return false;
    place();
    if (!shown) return false;
    const s = shown.session;
    const a = s.axis;
    const live = liveBoxes();
    ctx.strokeStyle = accent();
    ctx.lineWidth = 1.5 * px;
    ctx.setLineDash([3 * px, 3 * px]);
    for (const lane of sessionLanes(s, live)) {
      if (lane.length < 2) continue;
      const b = boundsOf(lane);
      ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); // on the box edges
    }
    ctx.setLineDash([]);
    // the size of each gap: equal numbers say "evenly spaced"
    const spots = handleSpots(s, live, px);
    const gaps = sessionGaps(s, live);
    ctx.font = `${11 * px}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    gaps.forEach((gap, i) => {
      const spot = spots[i];
      // where handles meet, only the later gap's number
      const next = spots[i + 1];
      if (next && Math.abs(next.along - spot.along) < SAME_SPOT_PX * px && Math.abs(next.cross - spot.cross) < SAME_SPOT_PX * px) return;
      const rounded = Math.round(gap.size);
      const label = String(Object.is(rounded, -0) ? 0 : rounded);
      const open = gap.size > 0;
      // in an open gap, only when the number fits with some room; otherwise the handle alone
      if (open && a === "x" && gap.size < ctx.measureText(label).width + 8 * px) return;
      if (open && a === "y" && gap.size < 16 * px) return;
      const [x, y] = a === "x" ? [spot.along, spot.cross - LABEL_OFFSET_PX * px] : [spot.cross + LABEL_OFFSET_PX * px, spot.along];
      if (!open) {
        // over nodes: a backing so it can be read
        const w = ctx.measureText(label).width + 6 * px;
        const h = 14 * px;
        ctx.fillStyle = labelBackground();
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h / 2, w, h, 3 * px);
        else ctx.rect(x - w / 2, y - h / 2, w, h);
        ctx.fill();
      }
      ctx.fillStyle = accent();
      ctx.fillText(label, x, y);
    });
    return true;
  }

  // handles follow pan and zoom; runs only while handles are shown
  function tick() {
    tickRaf = 0;
    if (!shown) return;
    place();
    overlay.request();
    if (shown) tickRaf = requestAnimationFrame(tick);
  }

  return { show, stop, draw, sessionFor, stateFor, pressAgain, afterPress };
}
