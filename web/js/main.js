import { app } from "../../../scripts/app.js";
import { createEnv, SETTINGS } from "./app/env.js";
import { createDragSnapper } from "./app/drag.js";
import { createGroupResizer } from "./app/groups.js";
import { createOverlay, snapGuides, installWireHighlight, wireFallback, groupGrip } from "./app/overlay.js";
import { createStatus, FEATURES } from "./app/status.js";
import { setAccentSource, accent, DEFAULT_ACCENT } from "./app/accent.js";
import { createMenu } from "./app/menu.js";
import { COMMAND_ID, TOOLBOX_ICON, ACTIONBAR_ICON } from "./app/buttons.js";

const stylesheet = document.createElement("link");
stylesheet.rel = "stylesheet";
stylesheet.href = new URL("../css/smart_guides.css", import.meta.url).href;
document.head.append(stylesheet);

const status = createStatus();
const env = createEnv(app, status);
const overlay = createOverlay(env);
const drag = createDragSnapper(env);
const groups = createGroupResizer(env);
const menu = createMenu(env, overlay);

const actionBarButton = {
  icon: `smart-guides-icon ${ACTIONBAR_ICON}`,
  tooltip: "Align and distribute",
  onClick: () => menu.toggle("actionbar"),
};

// The button the menu belongs to: the toolbox's, or the Run bar's when the toolbox is turned off.
const menuKind = () => (env.setting("Comfy.Canvas.SelectionToolbox", true) ? "toolbox" : "actionbar");

// The classes this extension needs on window (the frontend keeps them there for extensions).
const GLOBALS = ["LiteGraph", "LGraph", "LGraphCanvas", "LGraphNode", "LGraphGroup"];

/** Runs one part's install; an exception switches that part off instead of the whole extension. */
function installPart(features, fn) {
  try { fn(); } catch (err) {
    for (const f of features) status.report(f, "off", `install failed: ${err?.message ?? err}`);
    console.warn("[Smart Guides] install", err);
  }
}

app.registerExtension({
  name: "nomadoor.SmartGuides",

  settings: [
    { id: SETTINGS.enabled, category: ["Smart Guides", "Snap", "Enabled"], name: "Snap while dragging and resizing", type: "boolean", defaultValue: true },
    { id: SETTINGS.wires, category: ["Smart Guides", "Snap", "Wires"], name: "Snap to make wires horizontal", type: "boolean", defaultValue: true },
    { id: SETTINGS.edges, category: ["Smart Guides", "Snap", "Edges"], name: "Snap to other nodes' and groups' edges", type: "boolean", defaultValue: true },
    { id: SETTINGS.distance, category: ["Smart Guides", "Snap", "Distance"], name: "Snap distance (screen pixels)", type: "slider", attrs: { min: 2, max: 24, step: 1 }, defaultValue: 8 },
    { id: SETTINGS.followTheme, category: ["Smart Guides", "Color", "FollowTheme"], name: "Use the theme's accent color", type: "boolean", defaultValue: true, onChange: () => accent() },
    { id: SETTINGS.color, category: ["Smart Guides", "Color", "Custom"], name: "Color (when not using the theme's accent color)", type: "color", defaultValue: DEFAULT_ACCENT, onChange: () => accent() },
  ],

  commands: [
    { id: COMMAND_ID, label: "Align and distribute", icon: `smart-guides-icon ${TOOLBOX_ICON}`, function: () => menu.toggle(menuKind()) },
  ],

  getSelectionToolboxCommands() {
    return env.selectedNodes().length >= 2 ? [COMMAND_ID] : [];
  },

  // Shown only when the selection toolbox is turned off.
  get actionBarButtons() {
    // the frontend reads this list once, possibly before setup(): check the globals here directly
    if (GLOBALS.some((name) => !globalThis[name])) return [];
    return env.setting("Comfy.Canvas.SelectionToolbox", true) ? [] : [actionBarButton];
  },

  setup() {
    globalThis.SmartGuidesStatus = () => console.table(status.rows());
    const missing = GLOBALS.filter((name) => !globalThis[name]);
    if (missing.length) {
      // without them nothing can tell nodes from groups or wrap the canvas
      for (const f of Object.keys(FEATURES)) status.report(f, "off", `window.${missing.join(", window.")} not found`);
      return;
    }
    setAccentSource(() => ({ followTheme: env.setting(SETTINGS.followTheme, true), color: env.setting(SETTINGS.color, DEFAULT_ACCENT) }));
    accent();
    installPart(["snap", "grid"], () => drag.install());
    installPart(["groupCorners", "cursor"], () => groups.install());
    installPart(["toolboxButton", "actionBarButton"], () => menu.install());
    overlay.add(snapGuides(env, () => [drag.session, groups.session]));
    overlay.add(groupGrip(env, () => groups.activeCorner));
    let wireHook = null;
    installPart(["wireColor"], () => { wireHook = installWireHighlight(env, () => drag.session); });
    overlay.add(wireFallback(env, () => drag.session, wireHook));
    drag.onChange(() => { overlay.request(); if (app.canvas) app.canvas.dirty_bgcanvas = true; });
    groups.onChange(() => overlay.request());
  },
});
