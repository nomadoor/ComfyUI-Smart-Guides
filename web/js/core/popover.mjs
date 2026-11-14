// Where the menu goes, relative to the button that opened it. Pure: boxes are
// { left, top, bottom, width, height } in client coordinates (what getBoundingClientRect gives).

const GAP = 5; // the core popover's side offset
const VIEWPORT_MARGIN = 10;

/**
 * Centers the menu on the button, kept inside the viewport sideways. With preferAbove it sits
 * above `bar` (the toolbox the button is on), or below the bar when there is no room above;
 * otherwise it sits below the button.
 * @returns {{ left: number, top: number, above: boolean, arrowX: number }} rounded client
 *   coordinates of the menu, its side, and where its arrow points, from the menu's left.
 */
export function placePopover({ button, bar, menu, viewportWidth, preferAbove }) {
  const center = button.left + button.width / 2;
  const left = Math.max(VIEWPORT_MARGIN, Math.min(center - menu.width / 2, viewportWidth - menu.width - VIEWPORT_MARGIN));
  let above = preferAbove;
  let top = above ? bar.top - menu.height - GAP : button.bottom + GAP;
  if (above && top < VIEWPORT_MARGIN) { above = false; top = bar.bottom + GAP; }
  return { left: Math.round(left), top: Math.round(top), above, arrowX: Math.round(center - left) };
}
