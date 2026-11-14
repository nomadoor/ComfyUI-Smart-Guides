// The two buttons that open the menu: one on the selection toolbox (a command the extension
// returns from getSelectionToolboxCommands) and one next to Run (actionBarButtons) for when the
// toolbox is turned off. The frontend renders both from an icon class only, so they are found in
// the DOM by that class, and get their icon, name and unavailable state here.

export const COMMAND_ID = "SmartGuides.OpenMenu";
export const TOOLBOX_ICON = "smart-guides-toolbox-icon";
export const ACTIONBAR_ICON = "smart-guides-actionbar-icon";

const ICON_CLASS = { toolbox: TOOLBOX_ICON, actionbar: ACTIONBAR_ICON };

// The button's own icon: two bars meeting a dashed guide, then a chevron like the core Arrange button.
// Drawn here so it differs from the core's align icons (lucide align-*) and the Arrange icon (layout-grid).
const BUTTON_ICON =
  '<svg class="sg-button-icon" viewBox="0 0 24 24" aria-hidden="true">' +
  '<path d="M4 2v20" stroke-dasharray="2.5 2.5"/><rect x="7" y="5" width="13" height="5" rx="1.5"/><rect x="7" y="14" width="8" height="5" rx="1.5"/></svg>' +
  '<svg class="sg-button-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

/** t returns the UI strings for the current locale. */
export function createButtons(env, t) {
  /** The button element of kind 'toolbox' or 'actionbar', or null while it is not on the page. */
  function find(kind) {
    const iconClass = ICON_CLASS[kind];
    if (!iconClass) return null;
    return document.querySelector(`.${iconClass}`)?.closest("button") ?? null;
  }

  // The Run-bar button cannot be disabled through the extension API: show it as unavailable,
  // with the reason, while fewer than two nodes are selected.
  function updateActionBarButton() {
    const b = document.getElementsByClassName(ACTIONBAR_ICON)[0]?.closest("button");
    if (!b) return;
    const unavailable = env.selectedNodes().length < 2;
    const tr = t();
    const label = unavailable ? `${tr.menu} — ${tr.reasons.needTwo()}` : tr.menu;
    b.classList.toggle("smart-guides-unavailable", unavailable);
    b.setAttribute("aria-disabled", unavailable ? "true" : "false");
    if (b.title !== label) { b.title = label; b.setAttribute("aria-label", label); }
  }

  function install() {
    // draw the icon into both buttons whenever the frontend (re)creates them, and name the
    // toolbox button (the frontend renders it with an empty name)
    const icons = [document.getElementsByClassName(TOOLBOX_ICON), document.getElementsByClassName(ACTIONBAR_ICON)];
    const label = () => {
      for (const icon of icons.flatMap((list) => [...list])) {
        if (!icon.firstElementChild) icon.innerHTML = BUTTON_ICON;
        const b = icon.closest("button");
        if (icon.classList.contains(ACTIONBAR_ICON)) continue; // labeled by updateActionBarButton
        if (b && b.getAttribute("aria-label") !== t().menu) { b.setAttribute("aria-label", t().menu); b.title = t().menu; }
      }
    };
    // DOM work only: an exception here leaves the buttons as the frontend drew them
    const safe = (fn) => () => { try { fn(); } catch { /* ignore */ } };
    new MutationObserver(safe(label)).observe(document.body, { childList: true, subtree: true });
    setInterval(safe(updateActionBarButton), 250);
  }

  return { install, find };
}
