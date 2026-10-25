import { rebrandText } from "@vortex/shared";
import type { Dialog, MessageBoxOptions, MessageBoxSyncOptions } from "electron";

/**
 * mkeiitmods: the main process shows its dialogs (startup errors, database
 * problems, crash prompts) with plain English strings that say "Vortex". Rather
 * than editing each of them, and conflicting with upstream on every merge, the
 * dialog functions are wrapped once so the text shows our name.
 */

type BoxOptions = MessageBoxOptions | MessageBoxSyncOptions;

function rebrandBoxOptions<T extends BoxOptions>(options: T): T {
  return {
    ...options,
    title: options.title !== undefined ? rebrandText(options.title) : undefined,
    message: rebrandText(options.message),
    detail: options.detail !== undefined ? rebrandText(options.detail) : undefined,
    ...("checkboxLabel" in options && typeof options.checkboxLabel === "string"
      ? { checkboxLabel: rebrandText(options.checkboxLabel) }
      : {}),
    buttons: options.buttons?.map(rebrandText),
  };
}

// showMessageBox(Sync) accept an optional window as the first argument
function splitArgs(args: unknown[]): [unknown[], BoxOptions] {
  const options = args[args.length - 1] as BoxOptions;
  return [args.slice(0, -1), options];
}

let installed = false;

export function installDialogRebranding(dialog: Dialog): void {
  if (installed) {
    return;
  }
  installed = true;

  const showErrorBox = dialog.showErrorBox.bind(dialog);
  dialog.showErrorBox = (title: string, content: string) =>
    showErrorBox(rebrandText(title), rebrandText(content));

  const showMessageBox = dialog.showMessageBox.bind(dialog) as (
    ...args: unknown[]
  ) => ReturnType<Dialog["showMessageBox"]>;
  dialog.showMessageBox = ((...args: unknown[]) => {
    const [rest, options] = splitArgs(args);
    return showMessageBox(...rest, rebrandBoxOptions(options));
  }) as Dialog["showMessageBox"];

  const showMessageBoxSync = dialog.showMessageBoxSync.bind(dialog) as (
    ...args: unknown[]
  ) => number;
  dialog.showMessageBoxSync = ((...args: unknown[]) => {
    const [rest, options] = splitArgs(args);
    return showMessageBoxSync(...rest, rebrandBoxOptions(options));
  }) as Dialog["showMessageBoxSync"];
}

/** For tests only. */
export function resetDialogRebrandingForTests(): void {
  installed = false;
}
