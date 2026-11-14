// The align / distribute / match-size menu: a popover opened from one button on the selection
// toolbox, or from the Run bar when the toolbox is turned off (see ./buttons.mjs). Pressing a
// distribute button also shows the distribute handles (./handles.mjs).

import { runAction, buttonState, isDistribute, distributeAxis } from "../core/arrange.mjs";
import { startSession } from "../core/distribute.mjs";
import { placePopover } from "../core/popover.mjs";
import { strings } from "./i18n.mjs";
import { createButtons } from "./buttons.mjs";
import { createDistributeHandles, HANDLE_CLASS } from "./handles.mjs";

// Icons, 16x16.
const ICONS = {
  left: '<line x1="2" y1="1" x2="2" y2="15"/><rect class="f" x="4" y="3" width="9" height="3"/><rect class="f" x="4" y="10" width="6" height="3"/>',
  hcenter: '<line x1="8" y1="1" x2="8" y2="15"/><rect class="f" x="3" y="3" width="10" height="3"/><rect class="f" x="5" y="10" width="6" height="3"/>',
  right: '<line x1="14" y1="1" x2="14" y2="15"/><rect class="f" x="3" y="3" width="9" height="3"/><rect class="f" x="6" y="10" width="6" height="3"/>',
  distX: '<line x1="1.5" y1="2" x2="1.5" y2="14"/><line x1="14.5" y1="2" x2="14.5" y2="14"/><rect class="f" x="6" y="4" width="4" height="8"/>',
  top: '<line x1="1" y1="2" x2="15" y2="2"/><rect class="f" x="3" y="4" width="3" height="9"/><rect class="f" x="10" y="4" width="3" height="6"/>',
  vcenter: '<line x1="1" y1="8" x2="15" y2="8"/><rect class="f" x="3" y="3" width="3" height="10"/><rect class="f" x="10" y="5" width="3" height="6"/>',
  bottom: '<line x1="1" y1="14" x2="15" y2="14"/><rect class="f" x="3" y="3" width="3" height="9"/><rect class="f" x="10" y="6" width="3" height="6"/>',
  distY: '<line x1="2" y1="1.5" x2="14" y2="1.5"/><line x1="2" y1="14.5" x2="14" y2="14.5"/><rect class="f" x="4" y="6" width="8" height="4"/>',
  width: '<line x1="1.5" y1="3" x2="1.5" y2="13"/><line x1="14.5" y1="3" x2="14.5" y2="13"/><path d="M3.5 8h9M3.5 8l2.5-2.5M3.5 8l2.5 2.5M12.5 8l-2.5-2.5M12.5 8l-2.5 2.5"/>',
  height: '<line x1="3" y1="1.5" x2="13" y2="1.5"/><line x1="3" y1="14.5" x2="13" y2="14.5"/><path d="M8 3.5v9M8 3.5l-2.5 2.5M8 3.5l2.5 2.5M8 12.5l-2.5-2.5M8 12.5l2.5-2.5"/>',
};
const ROWS = [
  ["left", "hcenter", "right", "|", "distX", "|", "width"],
  ["top", "vcenter", "bottom", "|", "distY", "|", "height"],
];
const svg = (k) => `<svg viewBox="0 0 16 16" aria-hidden="true">${ICONS[k]}</svg>`;

const ARROW = '<svg class="sg-arrow" width="10" height="5" viewBox="0 0 12 6" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0L6 6L12 0"/></svg>';

export function createMenu(env, overlay) {
  let el = null;
  let anchorKind = null; // 'toolbox' | 'actionbar' while the menu is open
  let onButton = false; // opened on its button (else above the selection: the button was not found)
  let raf = 0;
  let lastSignature = ""; // what the button states were last computed from
  const t = () => strings(env.setting("Comfy.Locale", "en"));

  // ----- boxes of the current selection -----
  const selection = () => {
    const elements = env.nodeElements();
    return env.selectedNodes().map((n) => env.boxOf(n, elements));
  };
  const selectionKey = () => env.selectedNodes().map((n) => n.id).sort().join(",");

  const buttons = createButtons(env, t);
  const handles = createDistributeHandles(env, overlay, { selection, selectionKey, onDragEnd: () => refresh(true) });
  const anchorEl = () => buttons.find(anchorKind);

  // ----- menu element -----
  function build() {
    el = document.createElement("div");
    el.className = "smart-guides-menu";
    el.setAttribute("role", "toolbar");
    el.insertAdjacentHTML("beforeend", ARROW);
    for (const row of ROWS) {
      const r = document.createElement("div");
      r.className = "sg-row";
      for (const k of row) {
        if (k === "|") { const s = document.createElement("span"); s.className = "sg-sep"; r.append(s); continue; }
        const wrap = document.createElement("span");
        wrap.className = "sg-cell";
        const b = document.createElement("button");
        b.type = "button";
        b.className = "sg-btn";
        b.dataset.action = k;
        b.tabIndex = -1;
        b.innerHTML = svg(k);
        b.addEventListener("pointerdown", (e) => e.preventDefault()); // keep canvas focus
        b.addEventListener("click", () => press(k));
        wrap.append(b);
        r.append(wrap);
      }
      el.append(r);
    }
    document.body.append(el);
  }

  // The selected nodes' bounds in client coordinates, as a box like getBoundingClientRect's.
  function selectionClientRect() {
    const boxes = selection();
    const c = env.canvas();
    if (boxes.length < 2 || !c) return null;
    const cr = c.canvas.getBoundingClientRect();
    const { scale, offset } = c.ds;
    const x0 = Math.min(...boxes.map((b) => b.x)), y0 = Math.min(...boxes.map((b) => b.y));
    const x1 = Math.max(...boxes.map((b) => b.x + b.w)), y1 = Math.max(...boxes.map((b) => b.y + b.h));
    const left = cr.left + (x0 + offset[0]) * scale, top = cr.top + (y0 + offset[1]) * scale;
    const width = (x1 - x0) * scale, height = (y1 - y0) * scale;
    return { left, top, width, height, right: left + width, bottom: top + height };
  }

  // When the button cannot be found (the frontend renders it differently), the menu opens above
  // the selection instead (above the toolbox when there is one), pointing at the selection's middle.
  const toolboxEl = () => document.querySelector(".selection-toolbox");
  function anchorRects() {
    const a = anchorEl();
    if (onButton) {
      if (!a) return null; // its button went away (the toolbox hides during a drag): close
      const onToolbox = anchorKind === "toolbox";
      const bar = onToolbox ? a.closest(".selection-toolbox") ?? a : a;
      return { button: a.getBoundingClientRect(), bar: bar.getBoundingClientRect(), preferAbove: onToolbox };
    }
    const r = selectionClientRect();
    if (!r) return null;
    const tb = toolboxEl()?.getBoundingClientRect();
    const bar = tb && tb.height ? tb : r;
    const mid = { left: r.left + r.width / 2, width: 0, top: bar.top, bottom: bar.top, height: 0 };
    return { button: mid, bar, preferAbove: true };
  }

  // The toolbox button counts as missing only when the toolbox is on the page without it (the
  // toolbox itself comes and goes: hidden while dragging, replaced for a link selection).
  function reportButton(kind, found) {
    if (kind !== "toolbox") return;
    if (found) env.status.report("toolboxButton", "ok");
    else if (toolboxEl()) env.status.report("toolboxButton", "fallback", "toolbox shown without the button; the menu opens above it");
  }

  // Centered on the button, like the core Arrange popover. Above the toolbox (so the selected
  // nodes stay visible), below it only when there is no room; below the Run-bar button.
  function place() {
    if (!el) return false;
    const at = anchorRects();
    if (!at) return false;
    const p = placePopover({ ...at, menu: el.getBoundingClientRect(), viewportWidth: innerWidth });
    el.style.left = `${p.left}px`;
    el.style.top = `${p.top}px`;
    el.dataset.side = p.above ? "top" : "bottom";
    el.style.setProperty("--sg-arrow-x", `${p.arrowX}px`);
    return true;
  }

  // Button states and tooltips; recomputed only when the selected boxes or the locale changed.
  function refresh(force = false) {
    if (!el) return;
    const boxes = selection();
    const signature = boxes.map((b) => `${b.id}:${b.x},${b.y},${b.w},${b.h},${b.pinned ? 1 : 0}`).join("|") + `|${env.setting("Comfy.Locale", "en")}`;
    if (!force && signature === lastSignature) return;
    lastSignature = signature;
    const tr = t();
    for (const b of el.querySelectorAll(".sg-btn")) {
      const k = b.dataset.action;
      // while its handles are shown, a distribute button reads the lanes found at the press
      const st = (isDistribute(k) && handles.stateFor(distributeAxis(k))) || buttonState(boxes, k);
      b.classList.toggle("is-done", st.state === "done");
      b.disabled = st.state === "na" || (st.state === "done" && !isDistribute(k));
      const reason = st.reason ? tr.reasons[st.reason.code]?.(st.reason) : "";
      const label = reason ? `${tr[k]} — ${reason}` : tr[k];
      b.parentElement.title = label;
      b.setAttribute("aria-label", label);
    }
  }

  // While open, the menu follows its button and the selection every frame.
  function loop() {
    raf = 0;
    if (!el) return;
    try {
      if (!place()) { close(); return; }
      refresh();
    } catch (err) {
      console.warn("[Smart Guides] menu", err);
      close();
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  function open(kind) {
    anchorKind = kind;
    onButton = !!anchorEl();
    reportButton(kind, onButton);
    if (!onButton && env.selectedNodes().length < 2) { anchorKind = null; return; }
    if (!el) build();
    el.style.display = "";
    lastSignature = "";
    anchorEl()?.classList.add("smart-guides-active");
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function close() {
    anchorEl()?.classList.remove("smart-guides-active");
    if (el) el.style.display = "none";
    anchorKind = null;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  const isOpen = () => !!el && el.style.display !== "none" && anchorKind !== null;

  function toggle(kind) {
    if (isOpen() && anchorKind === kind) { close(); return; }
    // the Run-bar button is always there, and the command can run from the palette or a key:
    // with fewer than two nodes selected they do nothing
    if (env.selectedNodes().length < 2) return;
    close();
    open(kind);
  }

  // ----- actions -----
  function withUndo(fn) {
    const canvas = env.canvas();
    try { canvas.emitBeforeChange?.(); } catch { /* ignore */ }
    try { fn(); } finally { try { canvas.emitAfterChange?.(); } catch { /* ignore */ } }
  }

  function press(k) {
    const boxes = selection();
    if (isDistribute(k)) {
      const axis = distributeAxis(k);
      // handles shown for this button: press again with the lanes found at the first press
      const again = handles.pressAgain(axis);
      if (again) {
        if (again.length) withUndo(() => env.applyChanges(boxes, again));
        handles.afterPress();
      } else {
        const st = buttonState(boxes, k);
        if (st.state === "na") return;
        const session = startSession(boxes, axis); // lanes and gap from the boxes before the press
        if (st.state === "ok") withUndo(() => env.applyChanges(boxes, runAction(boxes, k)));
        handles.show(session);
      }
      refresh(true);
      return;
    }
    const st = buttonState(boxes, k);
    if (st.state === "na" || st.state === "done") return;
    withUndo(() => env.applyChanges(boxes, runAction(boxes, k)));
    refresh(true);
  }

  // ----- outside presses and keys -----
  function install() {
    addEventListener("pointerdown", (e) => {
      if (!isOpen()) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target && (el.contains(target) || anchorEl()?.contains(target))) return;
      // above the selection, the button it belongs to may be in the toolbox, unrecognized: its
      // click toggles the menu, so the press must not close it first
      if (!onButton && target?.closest?.(".selection-toolbox")) return;
      if (target?.closest?.(`.${HANDLE_CLASS}`)) return;
      close();
    }, true);
    addEventListener("keydown", (e) => { if (e.key === "Escape" && isOpen()) close(); }, true);
    buttons.install();
    overlay.add(handles.draw);
  }

  return { install, toggle, open, close, isOpen };
}
