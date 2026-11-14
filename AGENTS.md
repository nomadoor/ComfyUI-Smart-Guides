# AGENTS.md

## Agent skills

- Follow the engineering workflow in `docs/agents/workflow.md`.
- Read `docs/agents/issue-tracker.md`, `docs/agents/labels.md`, and `docs/agents/domain.md` before publishing work or changing domain guidance.
- Before touching drag, resize, toolbox, or drawing code, use `.claude/skills/frontend-source/` to read the frontend version that actually runs.
- Check browser behavior with `.claude/skills/browser-check/`.
- `.claude/`, `docs/review/`, and `docs/playground.html` are local only (git-ignored). They exist in the owner's checkout but not in the repository.

## Project Shape

- ComfyUI frontend extension that helps people place nodes by hand: snapping while dragging and resizing (to horizontal wires and other nodes' edges, shown with guides), and an align / distribute / match-size menu opened from one button on the standard selection toolbox.
- `docs/spec.md` is the source of truth for behavior. `docs/playground.html` is a feel prototype, not a spec; where they differ, the spec wins.
- Read `docs/review/2026-11-13-feasibility.md` and `docs/prior-art.md` before designing any part. Its open decisions (P1) are the owner's to make; do not settle them in code.
- Target: the frontend that ComfyUI-dev runs (`comfyui-frontend-package` 1.58.5 as of 2026-11-13), in both renderers: classic LiteGraph canvas and Nodes 2.0 (`Comfy.VueNodes.Enabled`).
- Python is only the entry point: `__init__.py` exposes `WEB_DIRECTORY`, with empty `NODE_CLASS_MAPPINGS`.
- `web/js/main.js` is the only extension entry. Supporting modules use `.mjs` so ComfyUI does not load them as separate extensions.
- No build step and no runtime dependencies.

## Architecture Rules

- Keep the math pure: snapping candidates, hysteresis, column detection, align / distribute / match-size results, and "already done / not applicable" button states live in `.mjs` modules with no DOM and no ComfyUI imports, and take plain rectangles and slot offsets.
- The pure core (`web/js/core/`) never branches on the renderer. How each renderer turns pointer events into positions is one model per renderer in `core/pointer_model.mjs`; detecting the press and the drag session per renderer lives in `app/drag.mjs`.
- Read geometry through the frontend, not constants: `node.boundingRect` for the visual box in the classic renderer, the node's DOM box in Nodes 2.0 (it draws headerless nodes from `pos.y - title height`), `node.getInputPos()` / `getOutputPos()` for slots. Never hard-code the title height, and never call `measure()` without `ctx` (it breaks collapsed widths).
- The canvas's event handlers (`processMouseDown/Move/Up`) are bound at canvas creation, so patching those on the prototype later has no effect. Methods the frontend looks up per call (`LGraphCanvas.prototype._processPrimaryButton`, `LGraph.prototype.getSnapToGridSize` / `snapToGrid`) can be wrapped at any time. The canvas stops propagation of its own `pointerdown`, so window listeners never see canvas presses in the bubble phase.
- Snap drags and node resizes by rewriting `clientX/Y` of `pointermove` / `pointerup` in the capture phase, so the frontend moves the node itself (both renderers; see `docs/review/2026-11-14-probes.md`). Only group corner resize replaces the frontend's drag callbacks.
- Every frontend internal the extension relies on is feature-detected; if one is missing, switch that feature off and keep the rest working.
  - Each feature reports through `app/status.mjs` (`ok` / `fallback` / `off`). Exceptions in a feature's own work (snapping, group corners, wire color, cursor) go to `status.fail(feature)` and never switch off other features; cosmetic DOM and drawing work (button labels, overlay frames) may only log. Prototype wrappers always call the original, guard their own code, and pass through when their feature is off. A drag or resize that ends with an exception still closes its undo transaction.
  - A new or changed reliance on an internal goes into `docs/frontend-dependencies.md` in the same change.
- What the user drops is where the node stays. Do not move nodes after release, and keep one drag or one menu action as one undo step in both renderers (`emitBeforeChange` / `emitAfterChange`).
- Never write to the frontend's settings. Read `pysssss.SnapToGrid`, `Comfy.SnapToGrid.GridSize`, and `Comfy.Canvas.SelectionToolbox` through `app.extensionManager.setting`.
- Node references go stale after undo (the graph is reloaded). Resolve nodes by id when a session (menu, handles) outlives one event.
- Draw guides above Nodes 2.0's DOM nodes, not only on the canvas, or they hide under nodes.
- Use American spelling in code, comments, and English docs.
- No network access, no `eval`, no new dependencies without asking.

## Testing

- `npm test` runs `tests/*.test.mjs` with Node's test runner. Use TDD for the pure modules.
- Check browser behavior in a ComfyUI started with only this extension loaded, in both renderers. Other alignment extensions (easykit-node-align is installed in ComfyUI-dev) fight this one; keep them out.
- Record what was checked, in which renderer and frontend version, in `AGENTS-STATE.md`.

## Stop And Ask

- Any behavior the spec does not state, or where the spec and the frontend disagree (start with the P1 list in the feasibility review).
- Choosing modifier keys, or suppressing a frontend behavior (grid snap, toolbox visibility, undo capture).
- Moving to a different frontend version as the target.
- Adding a dependency or a build step.
- Creating the GitHub repository, publishing anything, or changing `pyproject.toml` packaging metadata.

## Agent State

`AGENTS-STATE.md` is local working memory and is not committed. Read it before starting and update it after each meaningful step: current goal, files changed, checks run (with renderer and frontend version), next action, blockers or assumptions. Decisions go into the spec or an ADR, not into it.
