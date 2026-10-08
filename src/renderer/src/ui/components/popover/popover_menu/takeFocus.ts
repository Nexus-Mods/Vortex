/**
 * Hovering a row makes it the one the keyboard is on, so the pointer and the arrow
 * keys can't end up pointing at different rows — the menu shows a single focused row
 * either way, and arrowing on from a hovered row carries on from there.
 */
export const takeFocus = (row: HTMLButtonElement) => row.focus({ preventScroll: true });
