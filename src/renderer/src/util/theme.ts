/**
 * Theme switching — PROOF OF CONCEPT, dev only.
 *
 * Stamps `data-theme` on <html>, the way `reduceMotion` publishes its own preference, and
 * the stylesheets do the rest: `ui/theme/light.css` redefines the raw colour palette under
 * that selector, so nothing in the app has to know a theme exists.
 *
 * That is also the shape a user-written theme would take — a block of custom properties
 * scoped to a selector — which is why the switch is nothing more than an attribute.
 */
const THEME_ATTRIBUTE = "theme";

export type ITheme = "dark" | "light";

/** The theme in force, read from the attribute so there is one source of truth. */
export const getTheme = (): ITheme =>
  document.documentElement.dataset[THEME_ATTRIBUTE] === "light" ? "light" : "dark";

/**
 * `dark` removes the attribute rather than setting it, so the stylesheets only need the
 * one selector and the default costs nothing.
 */
export const applyTheme = (theme: ITheme): void => {
  if (theme === "light") {
    document.documentElement.dataset[THEME_ATTRIBUTE] = "light";
  } else {
    delete document.documentElement.dataset[THEME_ATTRIBUTE];
  }
};

/** Flips between the two and hands back what it landed on. */
export const toggleTheme = (): ITheme => {
  const next: ITheme = getTheme() === "light" ? "dark" : "light";

  applyTheme(next);

  return next;
};
