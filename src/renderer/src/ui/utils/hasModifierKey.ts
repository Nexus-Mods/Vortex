import type { KeyboardEvent } from "react";

/** Whether Alt, Ctrl, Meta or Shift is held, so a plain-key shortcut should step aside. */
export const hasModifierKey = (event: KeyboardEvent) =>
  event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
