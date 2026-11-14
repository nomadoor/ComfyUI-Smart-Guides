# Frontend dependencies

What this extension relies on in the ComfyUI frontend, which feature breaks when it changes,
and what happens then. Checked against 1.58.5 (running), 1.60.0 and upstream main
(2026-11-14): nothing below was missing or changed
in behavior.

When a frontend update breaks something, start here. `SmartGuidesStatus()` in the browser
console prints the status of every feature (`app/status.mjs`): `ok`, `fallback` (works another
way, with something lost) or `off` (switched off; the frontend's own behavior stays). A feature
that throws three times is switched off for the page; one exception only ends the current drag, and a clean drag resets the count.

## By feature

| Feature (status key) | Relies on | Where | When it is gone |
|---|---|---|---|
| everything (`globals`) | `window.LiteGraph`, `LGraph`, `LGraphCanvas`, `LGraphNode`, `LGraphGroup` (kept on window for extensions) | `main.js`, `app/env.mjs` | Every feature `off` at setup. The Run-bar button is left out when they are already missing the first time the frontend reads `actionBarButtons` (it does not read it again). |
| Snap (`snap`) | **Classic drag:** `canvas.isDragging`, `selectedItems`, `last_mouse`; the frontend moves items by `client - last_mouse` divided by the scale. **Nodes 2.0 drag:** `start + (client - pressClient) / scale`, one move per frame; auto-pan and Space pan shift the start. **Resize:** `canvas.resizing_node`, `node.findResizeDirection`, `computeSize`; Nodes 2.0 `[data-corner]`. **Both:** `ds.offset/scale/visible_area`, `read_only`, `dragging_canvas`, `convertEventToCanvasOffset`, `graph.getNodeOnPos/getGroupOnPos`, `group.isPointInTitlebar`, `visible_nodes`, `emitBeforeChange/emitAfterChange`, `renderingSize`, `setSize`, `boundingRect`; the frontend reading `clientX/clientY/shiftKey` from an event changed with `defineProperty`. Constants copied from the frontend: 6 px drag threshold (`CanvasPointer.maxClickDrift`), 50 px auto-pan band (`useAutoPan`). | `app/drag.mjs`, `core/pointer_model.mjs` | An exception ends the drag; three switch snapping off. **A changed formula throws nothing**: snapping lands in the wrong place. Fix in `core/pointer_model.mjs`. |
| Nodes 2.0 boxes (`nodeBoxes`) | `.lg-node[data-node-id]` inside the node layer (`[data-testid="transform-pane"]`, a child of the canvas container; the container itself when not found), `.lg-node-header`; `LiteGraph.vueNodesMode` | `app/env.mjs` | `fallback`: boxes from `boundingRect`; tops of nodes without a header (Reroute) are off by the header height. |
| Grid (`grid`) | `LGraph.prototype.getSnapToGridSize`, `snapToGrid`; `LiteGraph.alwaysSnapToGrid`; Nodes 2.0 rounds on release outside `snapToGrid` | `app/drag.mjs` | `off`: Shift rounds to the grid; with "always snap" on, the snapped axis is rounded on release. |
| Alt clone (part of `snap`) | `graph._nodes`, `LiteGraph.alt_drag_do_clone_nodes`, the clone being selected | `app/drag.mjs`, `core/clone.mjs` | The clone is dragged without snapping. |
| Group corners (`groupCorners`) | `LGraphCanvas.prototype._processPrimaryButton`; `canvas.pointer` (`onDragStart`, `onDrag`, `onDragEnd`, `finally`, whose setter runs the previous callback), `isDown`; `e.canvasX/canvasY`; `linkConnector.isConnecting`, `selectOnly`; `graph._groups`, `group.titleHeight`, `pos`/`size` setters, `LGraphGroup.minWidth/minHeight`. Press priority copied from the frontend: reroute (`getRerouteOnPos`), subgraph IO (`subgraph.getIoNodeOnPos`), link center (`_getLinkCentreOnPos`) keep the press. Not copied: link badges, Alt on a link, Ctrl marquee. | `app/groups.mjs` | `off`: no corners; the frontend's own bottom-right resize stays. A new press target in a corner is taken by the corner (no probe can see it). |
| Corner cursor (`cursor`) | `_updateCursorStyle`, `_setCursor`, `state.shouldSetCursor` | `app/groups.mjs` | `off`: the cursor does not change over corners. |
| Flat-wire color (`wireColor`) | `LGraphCanvas.prototype.drawConnections` being called for the links from `drawBackCanvas`, after it clears `dirty_bgcanvas`; `links_render_mode`, `LiteGraph.HIDDEN_LINK`, `connections_width`, `linkMarkerShape`, `LinkMarkerShape.None`; `link._pos`, `reroute._pos`; wires through `graph.getLink`, `getReroute`/`reroutes`, `link.parentId`, `reroute.pos`, `getInputPos/getOutputPos` | `app/overlay.mjs`, `app/env.mjs` | `fallback` when `drawConnections` is missing, or when the frontend redrew the background canvas (cleared `dirty_bgcanvas`) after a flat wire moved without calling it: drawn on the overlay, above the nodes. Links hidden one by one (a frontend store) are still recolored. |
| Toolbox button (`toolboxButton`) | `getSelectionToolboxCommands`; the button found by our icon class, its `<button>` ancestor; `.selection-toolbox` | `main.js`, `app/buttons.mjs`, `app/menu.mjs` | `fallback` (reported only when the toolbox is on the page without our button): the menu opens above the toolbox, or above the selection (the frontend still runs the command when its button is pressed). |
| Run-bar button (`actionBarButton`) | `actionBarButtons` (a getter: the frontend's list is computed and re-reads it only because the getter reads a setting); found by icon class | `main.js`, `app/buttons.mjs` | Not reported (the Run bar may be hidden). When the button is not found the menu opens above the selection. If `actionBarButtons` itself is gone there is no button; the command (palette, key) still opens the menu. |
| Overlay and handles | `canvas.canvas.parentElement` as host; z-index 40 above the Nodes 2.0 node layer | `app/overlay.mjs`, `app/handles.mjs`, `web/css/smart_guides.css` | Guides or handles hidden under nodes. Not detected. |
| Settings and colors | `extensionManager.setting.get`, `Comfy.Locale`, `Comfy.Canvas.SelectionToolbox`, `Comfy.SnapToGrid.GridSize`, `pysssss.SnapToGrid`; CSS `--primary`, `--muted-foreground` | `app/env.mjs`, `app/accent.mjs`, `app/menu.mjs` | Defaults. Not reported. |

## Not detected

- A changed drag or resize formula (snapping lands in the wrong place without an exception).
  A check after release was considered; it needs care with frame throttling, auto-pan, grid
  rounding and non-release endings (see the plan review) and is not built.
- Overlay below the nodes, new press targets in group corners, per-link hidden wires.
