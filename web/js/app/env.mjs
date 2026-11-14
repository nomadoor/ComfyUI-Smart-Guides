// Reads and writes the frontend: geometry, links, selection, settings.
// Everything that knows about LiteGraph objects lives here, so the core modules stay pure.

import { exitDistance } from "../core/snap.mjs";

export const SETTINGS = {
  enabled: "SmartGuides.Snap.Enabled",
  wires: "SmartGuides.Snap.Wires",
  edges: "SmartGuides.Snap.Edges",
  distance: "SmartGuides.Snap.Distance",
  followTheme: "SmartGuides.Color.FollowTheme",
  color: "SmartGuides.Color.Custom",
};

/** status: see ./status.mjs; env reports whether Nodes 2.0 boxes come from the DOM. */
export function createEnv(app, status) {
  const setting = (id, fallback) => {
    try {
      const v = app.extensionManager?.setting?.get(id);
      return v === undefined || v === null ? fallback : v;
    } catch {
      return fallback;
    }
  };

  const canvas = () => app.canvas;
  const graph = () => app.canvas?.graph;
  const isNode = (item) => !!globalThis.LGraphNode && item instanceof globalThis.LGraphNode;
  const isGroup = (item) => !!globalThis.LGraphGroup && item instanceof globalThis.LGraphGroup;
  const vueMode = () => !!globalThis.LiteGraph?.vueNodesMode;

  /**
   * The Nodes 2.0 node elements by id (one query), or null in the classic renderer. Only the
   * elements in the canvas's node layer count: node previews elsewhere on the page (the node
   * library, the sidebar inside the same container) use the same markup.
   */
  function nodeLayer() {
    const container = canvas()?.canvas?.parentElement;
    return container?.querySelector(':scope > [data-testid="transform-pane"]') ?? container ?? document;
  }

  function nodeElements() {
    if (!vueMode()) return null;
    const host = nodeLayer();
    const map = new Map();
    for (const el of host.querySelectorAll(".lg-node[data-node-id]")) map.set(el.getAttribute("data-node-id"), el);
    checkNodeElements(map);
    return map;
  }

  // No node element at all while a node is on screen means the markup changed: the boxes then
  // come from boundingRect (tops of nodes without a header are off by the header height).
  function checkNodeElements(map) {
    if (!status) return;
    if (map.size) { status.report("nodeBoxes", "ok"); return; }
    const area = visibleArea();
    const onScreen = (graph()?._nodes ?? []).some((n) => {
      const b = n.boundingRect;
      return b && (!area || overlaps({ x: b[0], y: b[1], w: b[2], h: b[3] }, area));
    });
    if (onScreen) status.report("nodeBoxes", "fallback", "no .lg-node[data-node-id] element on the canvas; using boundingRect");
  }

  /**
   * Visual box (header included) of a node or group, in canvas units, with the header height.
   * A node's pos is the top of its body in both renderers, so the header is pos.y - box top
   * (0 for nodes without a title, such as Reroute). A group's header is its title band.
   * elements is the map from nodeElements() when the caller measures several nodes; without
   * it the node's element is looked up on its own.
   */
  function rectOf(item, elements) {
    if (isNode(item) && vueMode()) {
      // Nodes 2.0 draws every node from pos.y - title height, also nodes without a header
      // (Reroute), so the box is measured from the DOM.
      const host = nodeLayer();
      const el = elements ? elements.get(String(item.id)) : host.querySelector(`.lg-node[data-node-id="${CSS.escape(String(item.id))}"]`);
      const c = canvas();
      if (el && c) {
        const cr = c.canvas.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        const s = c.ds.scale;
        const x = (r.left - cr.left) / s - c.ds.offset[0];
        const y = (r.top - cr.top) / s - c.ds.offset[1];
        const hasHeader = !!el.querySelector(".lg-node-header");
        return { x, y, w: r.width / s, h: r.height / s, head: hasHeader ? Math.max(0, item.pos[1] - y) : 0 };
      }
    }
    const b = item.boundingRect;
    const head = isNode(item)
      ? Math.max(0, item.pos[1] - b[1])
      : Math.min(b[3], Number(item.titleHeight) || globalThis.LiteGraph?.NODE_TITLE_HEIGHT || 0);
    return { x: b[0], y: b[1], w: b[2], h: b[3], head };
  }

  function visibleArea() {
    const v = canvas()?.ds?.visible_area;
    return v ? { x: v[0], y: v[1], w: v[2], h: v[3] } : null;
  }

  const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  /**
   * Nodes and groups on screen, except the ones in `exclude`, as snap targets
   * ({ id, x, y, w, h, head }). Off-screen items are dropped by their cheap box first (with a
   * margin for the Nodes 2.0 header and lag), so the DOM is read only for what may be visible,
   * through one element map.
   */
  function visibleTargets(exclude) {
    const g = graph();
    if (!g) return [];
    const area = visibleArea();
    const margin = 60;
    const loose = area ? { x: area.x - margin, y: area.y - margin, w: area.w + 2 * margin, h: area.h + 2 * margin } : null;
    const elements = nodeElements();
    const out = [];
    for (const item of [...(g._nodes ?? []), ...(g._groups ?? [])]) {
      if (exclude.has(item)) continue;
      const b = item.boundingRect;
      if (loose && b && !overlaps({ x: b[0], y: b[1], w: b[2], h: b[3] }, loose)) continue;
      const r = rectOf(item, elements);
      if (area && !overlaps(r, area)) continue;
      out.push({ id: itemKey(item), ...r });
    }
    return out;
  }

  /** A snap target's id: stable while a drag lasts (it names the target in a session's snap keys). */
  function itemKey(item) {
    return isNode(item) ? `n${item.id}` : `g${(graph()?._groups ?? []).indexOf(item)}`;
  }

  /**
   * Everything that moves with the given selection: selected items, plus group contents.
   * Pinned items do not move, so they stay targets.
   */
  function movingSet(selected, withGroupContents = true) {
    const out = new Set(selected.filter((it) => !it.pinned));
    if (!withGroupContents) return out;
    const visit = (item) => {
      if (!isGroup(item)) return;
      for (const child of item.children ?? []) {
        if (out.has(child) || child.pinned) continue;
        out.add(child);
        visit(child);
      }
    };
    for (const item of selected) visit(item);
    return out;
  }

  /**
   * Wire segments that start at a slot of this node, as { key, node, other, side, mine, theirs }.
   * mine is the slot, theirs the other end of the segment: the other node's slot, or, when the
   * wire goes through reroutes, the reroute next to this node. other is that node or reroute.
   * segment is the frontend object that owns the segment's center marker position (_pos): the
   * link for the segment that ends at an input, the reroute for the one that ends at a reroute.
   */
  function wiresOf(node) {
    const g = graph();
    if (!g || !isNode(node)) return [];
    const rerouteOf = (id) => (id == null ? null : g.getReroute?.(id) ?? g.reroutes?.get?.(id) ?? null);
    // walk the chain from the input side toward the output; the last one found is next to the output
    const firstReroute = (link) => {
      let r = rerouteOf(link.parentId);
      const seen = new Set();
      while (r && r.parentId != null && !seen.has(r)) {
        seen.add(r);
        const parent = rerouteOf(r.parentId);
        if (!parent) break;
        r = parent;
      }
      return r;
    };
    const out = [];
    (node.inputs ?? []).forEach((input, i) => {
      if (input?.link == null) return;
      const link = g.getLink(input.link);
      if (!link) return;
      if (link.parentId != null) {
        const r = rerouteOf(link.parentId); // the reroute next to this input
        if (r?.pos) out.push({ key: `wire:${link.id}:r`, node, other: r, side: "in", mine: node.getInputPos(i), theirs: [r.pos[0], r.pos[1]], segment: link });
        return;
      }
      const other = g.getNodeById(link.origin_id);
      if (!other || other === node) return;
      out.push({ key: `wire:${link.id}`, node, other, side: "in", mine: node.getInputPos(i), theirs: other.getOutputPos(link.origin_slot), segment: link });
    });
    (node.outputs ?? []).forEach((output, j) => {
      for (const id of output?.links ?? []) {
        const link = g.getLink(id);
        if (!link) continue;
        if (link.parentId != null) {
          const r = firstReroute(link); // the reroute next to this output
          if (r?.pos) out.push({ key: `wire:${link.id}:r`, node, other: r, side: "out", mine: node.getOutputPos(j), theirs: [r.pos[0], r.pos[1]], segment: r });
          continue;
        }
        const other = g.getNodeById(link.target_id);
        if (!other || other === node) continue;
        out.push({ key: `wire:${link.id}`, node, other, side: "out", mine: node.getOutputPos(j), theirs: other.getInputPos(link.target_slot), segment: link });
      }
    });
    // several links of one output can share the first reroute: keep one segment per reroute
    const seenKeys = new Set();
    return out.filter((w) => {
      const k = w.other && !isNode(w.other) ? `r:${w.side}:${w.mine[0]},${w.mine[1]}:${w.theirs[0]},${w.theirs[1]}` : w.key;
      if (seenKeys.has(k)) return false;
      seenKeys.add(k);
      return true;
    });
  }

  /** The selected nodes (groups and reroutes on wires left out). */
  function selectedNodes() {
    const items = [...(canvas()?.selectedItems ?? [])];
    return items.filter(isNode);
  }

  /** The size a node or group is shown at. Nodes 2.0 renders max(size, content). */
  const renderedSize = (item) => item.renderingSize ?? item.size;

  function setSize(node, size) {
    if (typeof node.setSize === "function") node.setSize(size);
    else node.size = size;
  }

  /** A node as a box for the menu (see ../core/arrange.mjs), measured through `elements` like rectOf. */
  function boxOf(node, elements) {
    const r = rectOf(node, elements);
    return {
      id: String(node.id),
      ...r,
      pinned: !!node.pinned || !!node.flags?.pinned,
      fixedSize: node.type === "Reroute" || node.resizable === false || !!node.flags?.collapsed,
      node,
    };
  }

  /** Applies menu changes ({id, x, y} / {id, w} / {id, h}) to nodes, as visual-box values. */
  function applyChanges(boxes, changes) {
    const byId = new Map(boxes.map((b) => [b.id, b]));
    for (const c of changes) {
      const b = byId.get(c.id);
      if (!b) continue;
      const n = b.node;
      if (c.x !== undefined || c.y !== undefined) {
        const dx = (c.x ?? b.x) - b.x;
        const dy = (c.y ?? b.y) - b.y;
        n.pos = [n.pos[0] + dx, n.pos[1] + dy];
      }
      if (c.w !== undefined || c.h !== undefined) {
        const dw = (c.w ?? b.w) - b.w;
        const dh = (c.h ?? b.h) - b.h;
        const base = renderedSize(n); // start from what is rendered
        setSize(n, [base[0] + dw, base[1] + dh]);
      }
    }
    canvas()?.setDirty(true, true);
  }

  function gridSize() {
    return Number(setting("Comfy.SnapToGrid.GridSize", 10)) || 0;
  }

  return {
    status, canvas, graph, setting, isNode, vueMode, rectOf, visibleTargets, movingSet, wiresOf,
    selectedNodes, boxOf, nodeElements, renderedSize, setSize, applyChanges, gridSize,
    alwaysSnap: () => !!setting("pysssss.SnapToGrid", false),
    /** This extension's snap settings; inPx / outPx are the enter and exit distances. */
    snapOptions: () => {
      const inPx = Number(setting(SETTINGS.distance, 8)) || 8;
      return {
        enabled: !!setting(SETTINGS.enabled, true),
        wires: !!setting(SETTINGS.wires, true),
        edges: !!setting(SETTINGS.edges, true),
        inPx,
        outPx: exitDistance(inPx),
      };
    },
  };
}
