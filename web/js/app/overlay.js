// A canvas laid over the graph canvas, above the Nodes 2.0 node layer, so nothing drawn on it
// hides under nodes; and the draw jobs for it: snap guides with the slot dots of flat wires, and
// the group corner grip (the distribute handles add their own job, see ./handles.js).
// The flat wires themselves are recolored on the graph canvas, under the nodes.
// Everything is computed from live geometry at draw time.

import { alignedGuides } from "../core/guides.js";
import { gripSegments } from "../core/corners.js";
import { isFlat } from "../core/snap.js";
import { accent, cachedCssVar } from "./accent.js";

// the edges of a resized box that move, by corner
const EDGES = { NW: ["left", "top"], NE: ["right", "top"], SW: ["left", "bottom"], SE: ["right", "bottom"] };

export function createOverlay(env) {
  let el = null;
  let ctx = null;
  let raf = 0;
  // draw jobs: (ctx, px) => boolean, with ctx in canvas units and px one screen pixel in them;
  // true asks for another frame
  const sources = [];

  function ensure() {
    const canvas = env.canvas();
    const host = canvas?.canvas?.parentElement;
    if (!host) return false;
    if (!el || el.parentElement !== host) {
      el?.remove();
      el = document.createElement("canvas");
      el.className = "smart-guides-overlay";
      host.appendChild(el);
      ctx = el.getContext("2d");
    }
    const c = canvas.canvas;
    const dpr = globalThis.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    el.style.left = `${c.offsetLeft}px`;
    el.style.top = `${c.offsetTop}px`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
    }
    return true;
  }

  function frame() {
    raf = 0;
    if (!ensure()) return;
    const canvas = env.canvas();
    const dpr = globalThis.devicePixelRatio || 1;
    const { scale, offset } = canvas.ds;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, el.width, el.height);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offset[0] * scale, dpr * offset[1] * scale);
    const px = 1 / scale; // one screen pixel in canvas units
    let again = false;
    for (const src of sources) {
      ctx.save();
      try { again = src(ctx, px) || again; } catch (err) { console.warn("[Smart Guides] draw", err); }
      ctx.restore();
    }
    if (again) request();
  }

  function request() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function add(src) { sources.push(src); }

  return { request, add };
}

/** Draw job for drag / resize sessions. */
export function snapGuides(env, getSessions) {
  return (ctx, px) => {
    const sessions = getSessions().filter(Boolean);
    if (!sessions.length) return false;
    const opts = env.snapOptions();
    for (const s of sessions) {
      if (!opts.enabled || s.shift) continue;
      // a moving item's DOM lags a frame in Nodes 2.0; build its box from pos and the press-time offsets
      const rect = s.mode === "drag" && s.offset && s.size
        ? { x: s.item.pos[0] + s.offset[0], y: s.item.pos[1] + s.offset[1], w: s.size[0], h: s.size[1], head: s.head ?? 0 }
        : env.rectOf(s.item);
      const corner = s.corner;
      const edges = s.mode === "drag" ? undefined : EDGES[corner];
      if (opts.edges && !s.wireOnly) {
        const guides = alignedGuides(rect, s.targets, { edges, scope: opts.scope });
        // On each box, a solid line along its aligned edge; between boxes, a dashed line.
        // The line never runs dashed through a node, so a top guide at the body top reads as
        // "these edges line up" rather than a line crossing the nodes.
        // Tops align by the body, but are drawn at the top of the boxes (headers are all the same
        // height); a box without a header gets its edge at its own top (see core/guides.js).
        const seg = (g, at, from, to) => {
          ctx.beginPath();
          if (g.orient === "v") { ctx.moveTo(at, from); ctx.lineTo(at, to); }
          else { ctx.moveTo(from, at); ctx.lineTo(to, at); }
          ctx.stroke();
        };
        ctx.strokeStyle = accent();
        for (const g of guides) {
          ctx.setLineDash([]);
          ctx.lineWidth = 2 * px;
          for (const [from, to, at] of g.spans) seg(g, at, from, to);
          ctx.setLineDash([6 * px, 5 * px]);
          ctx.lineWidth = 1.2 * px;
          for (let i = 0; i + 1 < g.spans.length; i++) {
            if (g.spans[i + 1][0] > g.spans[i][1]) seg(g, g.drawAt, g.spans[i][1], g.spans[i + 1][0]);
          }
        }
        ctx.setLineDash([]);
      }
      // flat wires: the wire is recolored with the links (installWireHighlight); the slot dots at
      // both ends are recolored here, above the nodes
      if (opts.wires && s.mode === "drag") {
        ctx.fillStyle = accent();
        for (const w of flatWires(env, s)) {
          for (const p of [w.mine, w.theirs]) {
            ctx.beginPath();
            ctx.arc(p[0], p[1], 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
    return true;
  };
}

/**
 * The wires to highlight during a drag session: wires from the moving nodes to something that
 * stays, that are horizontal now (see env.wiresOf for their shape).
 */
export function flatWires(env, s) {
  if (!s || s.mode !== "drag" || s.shift) return [];
  const opts = env.snapOptions();
  if (!opts.enabled || !opts.wires) return [];
  const out = [];
  for (const n of s.moving ?? []) {
    if (!env.isNode(n) && !env.isIoNode(n)) continue;
    for (const w of env.wiresOf(n)) {
      if (!s.moving.has(w.other) && isFlat(w.mine[1], w.theirs[1])) out.push(w);
    }
  }
  return out;
}

/** Draws the flat wires as straight accent segments, with the center marker. */
function drawFlatWires(ctx, wires, width, marker) {
  const color = accent();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  for (const w of wires) {
    ctx.beginPath();
    ctx.moveTo(w.mine[0], w.mine[1]);
    ctx.lineTo(w.theirs[0], w.theirs[1]);
    ctx.stroke();
    if (!marker) continue;
    // the frontend's center marker (radius 5), where the frontend put it
    const m = w.segment?._pos;
    const at = m && Number.isFinite(m[0]) && Number.isFinite(m[1]) && (m[0] || m[1]) ? m : [(w.mine[0] + w.theirs[0]) / 2, w.mine[1]];
    ctx.beginPath();
    ctx.arc(at[0], at[1], 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Background redraws without drawConnections before the recolor moves to the overlay. One is
// enough: in the frontend, dirty_bgcanvas is cleared in one place only, right before the links are drawn.
const MISSES_BEFORE_FALLBACK = 1;

/**
 * Recolors flat wires: right after the frontend draws the links, the same straight segment is
 * drawn again in the accent color at the link's width, so the wire itself changes color (above
 * the links, under the nodes). drawConnections is looked up per call, so wrapping the prototype
 * works after the canvas exists.
 */
export function installWireHighlight(env, getSession) {
  const status = env.status;
  const proto = globalThis.LGraphCanvas?.prototype;
  if (!proto || typeof proto.drawConnections !== "function") {
    status.report("wireColor", "fallback", "LGraphCanvas.prototype.drawConnections not found; drawn above the nodes");
    return null;
  }
  let lastCall = 0;
  const orig = proto.drawConnections;
  proto.drawConnections = function (ctx, ...rest) {
    let result;
    try { result = orig.call(this, ctx, ...rest); } finally { lastCall = performance.now(); }
    if (status.get("wireColor") !== "ok") return result;
    try {
      const hidden = this.links_render_mode === globalThis.LiteGraph?.HIDDEN_LINK;
      const wires = hidden ? [] : flatWires(env, getSession());
      if (wires.length) {
        ctx.save();
        try {
          // a little thicker than the links, so the one that just lined up stands out
          drawFlatWires(ctx, wires, (this.connections_width || 3) + 2, this.linkMarkerShape !== globalThis.LiteGraph?.LinkMarkerShape?.None);
        } finally {
          ctx.restore();
        }
      }
    } catch (err) {
      status.fail("wireColor", err);
    }
    return result;
  };
  return { lastCall: () => lastCall };
}

/**
 * Overlay draw job for the wire recolor when it cannot happen inside drawConnections: the same
 * segments, above the nodes. hook is what installWireHighlight returned (null when it found
 * nothing to wrap); with it, this job also notices when the frontend stops calling it.
 */
export function wireFallback(env, getSession, hook) {
  const status = env.status;
  let lastKey = "";
  let movedAt = 0; // when the flat wires last moved
  let pending = false; // a background redraw was asked for at movedAt and has not happened yet
  let misses = 0;
  // The frontend draws the links in drawBackCanvas, which first clears dirty_bgcanvas and then
  // calls drawConnections. So once dirty_bgcanvas, set when a flat wire moved, is false again,
  // drawConnections must have run since; if it did not, the frontend stopped calling it.
  function watch(c, key, now) {
    if (key !== lastKey) {
      lastKey = key;
      movedAt = now;
      c.dirty_bgcanvas = true;
      pending = true;
      return;
    }
    if (!pending || c.dirty_bgcanvas !== false) return;
    pending = false;
    misses = hook.lastCall() < movedAt ? misses + 1 : 0;
    if (misses >= MISSES_BEFORE_FALLBACK) status.report("wireColor", "fallback", "the frontend no longer calls drawConnections; drawn above the nodes");
  }
  return (ctx) => {
    const s = getSession();
    if (!s || status.isOff("wireColor")) { lastKey = ""; pending = false; return false; }
    const wires = flatWires(env, s);
    if (!wires.length) { lastKey = ""; pending = false; return true; }
    const c = env.canvas();
    if (!c) return true;
    if (hook && status.get("wireColor") === "ok") watch(c, wires.map((w) => `${w.mine},${w.theirs}`).join("|"), performance.now());
    if (status.get("wireColor") !== "fallback") return true;
    if (c.links_render_mode === globalThis.LiteGraph?.HIDDEN_LINK) return true;
    drawFlatWires(ctx, wires, (c.connections_width || 3) + 2, c.linkMarkerShape !== globalThis.LiteGraph?.LinkMarkerShape?.None);
    return true;
  };
}

const mutedColor = cachedCssVar("--muted-foreground", "#8a8a8a");

/**
 * Draw job for the group corner grip: shown only while the pointer is on a corner handle or the
 * corner is being dragged (not on every group hover). Same shape and color as a Nodes 2.0 node's
 * resize grip.
 */
export function groupGrip(env, getActive) {
  return (ctx) => {
    const a = getActive();
    if (!a?.group) return false;
    const rect = env.rectOf(a.group);
    ctx.strokeStyle = mutedColor();
    ctx.lineWidth = 2 * (8 / 12);
    ctx.lineCap = "round";
    for (const [x1, y1, x2, y2] of gripSegments(rect, a.corner)) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    return false;
  };
}
