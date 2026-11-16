// One color for everything this extension draws to say "lined up" or "evenly spaced": ComfyUI's
// accent color (--primary, the Run button), so it follows the theme. Parts differ by form.
// The user can pick another color in the settings (SETTINGS.followTheme / SETTINGS.color).

/** The color setting's default, as the settings store keeps colors: hex without "#". */
export const DEFAULT_ACCENT = "0b8ce9";

const CSS_VAR_TTL_MS = 500;

/**
 * A reader for a CSS variable of the document, read at most every 500 ms (getComputedStyle per
 * draw adds up) and still following a theme change.
 */
export function cachedCssVar(name, fallback) {
  let value = null;
  let readAt = 0;
  return () => {
    const now = performance.now();
    if (!value || now - readAt > CSS_VAR_TTL_MS) {
      value = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
      readAt = now;
    }
    return value;
  };
}

const themeAccent = cachedCssVar("--primary", `#${DEFAULT_ACCENT}`);

let accentSetting = () => ({ followTheme: true, color: DEFAULT_ACCENT });

/** Sets where accent() reads the two color settings from: () => ({ followTheme, color }). */
export function setAccentSource(fn) { accentSetting = fn; }

/** The accent color as a CSS color. Also keeps --sg-accent, which the stylesheet uses, up to date. */
export function accent() {
  let color = `#${DEFAULT_ACCENT}`;
  try {
    const s = accentSetting();
    const custom = String(s.color ?? "").replace(/^#/, "");
    if (!s.followTheme && /^([0-9a-f]{6}|[0-9a-f]{8})$/i.test(custom)) color = `#${custom}`;
    else color = themeAccent();
    // the menu and the handles (DOM) read it as a CSS variable
    if (document.documentElement.style.getPropertyValue("--sg-accent") !== color) {
      document.documentElement.style.setProperty("--sg-accent", color);
    }
  } catch { /* keep the fallback */ }
  return color;
}
