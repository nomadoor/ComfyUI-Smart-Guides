# ComfyUI Smart Guides

[![English](https://img.shields.io/badge/lang-English-blue)](README.md)
[![日本語](https://img.shields.io/badge/lang-%E6%97%A5%E6%9C%AC%E8%AA%9E-red)](README_ja.md)

An extension for laying out nodes neatly on the ComfyUI canvas. Works with both the classic renderer and Nodes 2.0.

## Installation

Search for "Smart Guides" in ComfyUI Manager and install it.

## Smart guides

<!-- Video: Smart guides -->

When you drag or resize a node or group, it snaps to:

- positions where wires become horizontal
- the edges of other nodes and groups
- positions right next to another node or group

Guide lines appear on aligned edges. Hold Shift while moving to turn snapping off.

## Align and distribute

<!-- Video: Align and distribute -->

Select two or more nodes and press the align button in the selection toolbox to open the menu.

- Align left, center, right, top, middle, or bottom
- Match width or height
- Distribute evenly, horizontally or vertically

After distributing, a handle appears in each gap. Drag one to change all the gaps together.

> [!NOTE]
> If "Show selection toolbox" is turned off in ComfyUI's settings, the align button appears next to Run.

## Group resizing

<!-- Video: Group resizing -->

Resize a group from any of its four corners.

## Settings

The following can be set in ComfyUI's ⚙ `Settings` → `Smart Guides` tab:

- Snap while dragging and resizing
- Snap to make wires horizontal
- Snap to other nodes' and groups' edges
- Snap distance (screen pixels)
- Guide color (the theme's accent color, or a color you choose)

## License

MIT
