// Group resize from all four corners (the frontend only offers the bottom-right triangle).
//
// LGraphCanvas.prototype._processPrimaryButton is looked up on every press, so wrapping it
// works after the canvas exists. After the frontend has handled the press, when it landed on a
// group corner handle (which reaches a little outside the group, like a Nodes 2.0 node's
// handles; see ../core/corners.mjs), the drag callbacks of app.canvas.pointer are replaced.
// Clicks, selection, renaming and the context menu stay with the frontend.

import { solveResize } from "../core/snap.mjs";
import { cornerAt } from "../core/corners.mjs";
import { resizedBy, withEdgesOnGrid, withMinSize } from "../core/resize.mjs";

const CURSOR = { NW: "nwse-resize", SE: "nwse-resize", NE: "nesw-resize", SW: "nesw-resize" };

export function createGroupResizer(env) {
  const status = env.status;
  let session = null; // an active corner resize: { mode: "groupResize", item, corner, targets, snapX, snapY, current, shift }
  let hover = null; // { group, corner } under the pointer while it is up
  const listeners = new Set();
  const notify = () => { for (const fn of listeners) fn(session); };

  /** The topmost unpinned group whose corner handle is under (x, y). */
  function groupCornerAt(x, y) {
    const groups = env.graph()?._groups ?? [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const g = groups[i];
      if (g.pinned) continue;
      const corner = cornerAt(env.rectOf(g), x, y);
      if (corner) return { group: g, corner };
    }
    return null;
  }

  // Replaces the drag callbacks of the press the frontend has just handled, when it landed on a
  // group corner handle.
  function takeOver(canvas, e) {
    const [x, y] = [e.canvasX, e.canvasY];
    if (x === undefined || y === undefined) return;
    if (canvas.linkConnector?.isConnecting) return;
    const hit = groupCornerAt(x, y);
    if (!hit) return;
    // only when the frontend took the press for the group or empty canvas: a reroute, a link
    // center or a subgraph input/output in the corner keeps its own drag
    const g = canvas.graph;
    if (g?.getRerouteOnPos?.(x, y)) return;
    if (canvas.subgraph?.getIoNodeOnPos?.(x, y)) return;
    try { if (canvas._getLinkCentreOnPos?.(e)) return; } catch { /* ignore */ }
    const { group, corner } = hit;
    const startRect = env.rectOf(group);
    const p = canvas.pointer;
    if (!p || typeof p !== "object") throw new Error("canvas.pointer not found");
    let open = false; // an undo transaction is open
    // the undo transaction is closed first, so nothing after it can leave it open
    const close = () => {
      if (open) { open = false; try { canvas.emitAfterChange?.(); } catch { /* ignore */ } }
      if (session?.item === group) {
        session = null;
        notify();
        try { canvas._updateCursorStyle?.(); } catch (err) { status.fail("cursor", err); }
      }
    };
    // the click stays the frontend's (select on the title, deselect or marquee in the body)
    p.onDragStart = () => {
      canvas.dragging_canvas = false;
      try { canvas.emitBeforeChange?.(); open = true; } catch { /* ignore */ }
      // the selection stays as it was, as with the frontend's own group resize
      try {
        session = {
          mode: "groupResize", item: group, corner, current: {}, snapX: null, snapY: null, shift: false,
          targets: env.visibleTargets(new Set([group])),
        };
        notify();
        canvas._updateCursorStyle?.();
      } catch (err) {
        status.fail("groupCorners", err);
        close();
      }
    };
    p.onDrag = (ev) => {
      if (!session) return;
      try {
        session.targets = env.visibleTargets(new Set([group]));
        const rect = resizedRect(session, startRect, ev.canvasX - x, ev.canvasY - y, !!ev.shiftKey, canvas.ds.scale);
        group.pos = [rect.x, rect.y];
        group.size = [rect.w, rect.h];
        canvas.setDirty(true, true);
        notify();
      } catch (err) {
        // leave the group where it is; the rest of this drag does nothing
        status.fail("groupCorners", err);
        close();
      }
    };
    p.onDragEnd = () => { if (session?.item === group) status.clean("groupCorners"); close(); };
    // the CanvasPointer setter runs the previous finally callback before replacing it
    p.finally = () => close();
  }

  /**
   * The group's rect after the pointer traveled (dx, dy) from the press: snapped, then on
   * ComfyUI's grid where it applies, then no smaller than a group may be. Updates the session's snap.
   */
  function resizedRect(s, startRect, dx, dy, shiftKey, scale) {
    const opts = env.snapOptions();
    const corner = s.corner;
    // ComfyUI's grid: always when "always snap" is on; with Shift only when this extension's snapping is off
    const grid = env.alwaysSnap() || (shiftKey && !opts.enabled) ? env.gridSize() : 0;
    const minW = globalThis.LGraphGroup?.minWidth ?? 140;
    const minH = globalThis.LGraphGroup?.minHeight ?? 80;
    let rect = resizedBy(startRect, corner, dx, dy);
    s.shift = shiftKey;
    if (opts.enabled && !s.shift) {
      const res = solveResize({ rect, corner, targets: s.targets, scale, inPx: opts.inPx, outPx: opts.outPx, current: s.current, minW, minH, edges: opts.edges });
      s.snapX = res.snapX; s.snapY = res.snapY;
      s.current = { x: res.snapX?.key, y: res.snapY?.key };
      rect = res.rect;
    } else {
      s.snapX = s.snapY = null; s.current = {};
    }
    // the grid is for the edges that did not snap
    if (grid) rect = withEdgesOnGrid(rect, corner, grid, !s.snapX, !s.snapY);
    return withMinSize(rect, startRect, corner, minW, minH);
  }

  // LGraphCanvas.prototype._processPrimaryButton: let the frontend handle the press, then take
  // over its drag when it was on a group corner.
  function wrapPrimaryButton(proto) {
    const orig = proto._processPrimaryButton;
    proto._processPrimaryButton = function (e, node, ...rest) {
      const result = orig.call(this, e, node, ...rest);
      if (status.isOff("groupCorners")) return result;
      try {
        if (!node && !this.read_only && !this.selectOnly) takeOver(this, e);
      } catch (err) {
        status.fail("groupCorners", err);
      }
      return result;
    };
  }

  // Cursor over the corners. The frontend decides the cursor in _updateCursorStyle (looked up per
  // call) through a cache, so the corner cursor goes through the same path instead of style.cursor.
  function wrapCursorStyle(proto) {
    const origCursor = proto._updateCursorStyle;
    proto._updateCursorStyle = function (...args) {
      const result = origCursor.apply(this, args);
      if (status.isOff("cursor") || status.isOff("groupCorners")) return result;
      try {
        if (this.state?.shouldSetCursor === false) return result;
        const corner = session?.corner ?? (!this.dragging_canvas && !this.pointer?.isDown && !this.read_only ? hover?.corner : null);
        if (!corner) return result;
        // _setCursor is set on the canvas instance (a cursor cache), not on the prototype
        if (typeof this._setCursor === "function") this._setCursor(CURSOR[corner]);
        else status.report("cursor", "off", "canvas._setCursor not found");
      } catch (err) { status.fail("cursor", err); }
      return result;
    };
  }

  // Which corner handle the pointer is over while it is up, for the cursor and the grip.
  function trackHover() {
    addEventListener("pointermove", (e) => {
      if (status.isOff("groupCorners")) { if (hover) { hover = null; notify(); } return; }
      const canvas = env.canvas();
      let next = null;
      try {
        if (canvas && e.target === canvas.canvas && !canvas.pointer?.isDown && !canvas.read_only && !canvas.selectOnly) {
          const [x, y] = canvas.convertEventToCanvasOffset(e);
          if (!env.graph()?.getNodeOnPos(x, y, canvas.visible_nodes)) next = groupCornerAt(x, y);
        }
      } catch { next = null; }
      const changed = next?.group !== hover?.group || next?.corner !== hover?.corner;
      hover = next; // read by the frontend's own cursor update that follows this event
      if (changed) notify();
    }, true);
    addEventListener("pointerout", (e) => {
      if (hover && e.target === env.canvas()?.canvas) { hover = null; notify(); }
    }, true);
  }

  /** Installs nothing, and reports the feature off, when the frontend has no _processPrimaryButton to wrap. */
  function install() {
    const proto = globalThis.LGraphCanvas?.prototype;
    if (!proto || typeof proto._processPrimaryButton !== "function") {
      status.report("groupCorners", "off", "LGraphCanvas.prototype._processPrimaryButton not found; the frontend's own bottom-right resize stays");
      status.report("cursor", "off", "goes with the group corners");
      return;
    }
    wrapPrimaryButton(proto);
    if (typeof proto._updateCursorStyle === "function") wrapCursorStyle(proto);
    else status.report("cursor", "off", "LGraphCanvas.prototype._updateCursorStyle not found");
    trackHover();
  }

  return {
    install,
    get session() { return session; },
    /** The corner whose grip is shown: the one being resized, else the one under the pointer. */
    get activeCorner() {
      if (session) return { group: session.item, corner: session.corner };
      return hover;
    },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
