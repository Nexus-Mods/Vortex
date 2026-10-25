import type { Dialog } from "electron";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { installDialogRebranding, resetDialogRebrandingForTests } from "./rebrandDialogs";

function makeDialog() {
  const calls = {
    errorBox: vi.fn(),
    messageBox: vi.fn(async () => ({ response: 0, checkboxChecked: false })),
    messageBoxSync: vi.fn(() => 0),
  };
  const dialog = {
    showErrorBox: calls.errorBox,
    showMessageBox: calls.messageBox,
    showMessageBoxSync: calls.messageBoxSync,
  } as unknown as Dialog;
  return { dialog, calls };
}

describe("installDialogRebranding", () => {
  beforeEach(() => resetDialogRebrandingForTests());

  it("renames Vortex in error boxes", () => {
    const { dialog, calls } = makeDialog();
    installDialogRebranding(dialog);
    dialog.showErrorBox("Vortex failed to start up", "Please restart Vortex.");
    expect(calls.errorBox).toHaveBeenCalledWith(
      "mkeiitmods failed to start up",
      "Please restart mkeiitmods.",
    );
  });

  it("renames Vortex in message boxes, with or without a parent window", async () => {
    const { dialog, calls } = makeDialog();
    installDialogRebranding(dialog);
    const win = {} as Electron.BrowserWindow;
    await dialog.showMessageBox(win, {
      title: "Vortex unresponsive",
      message: "Vortex appears to be frozen",
      buttons: ["Restart Vortex", "Quit"],
    });
    expect(calls.messageBox).toHaveBeenCalledWith(win, {
      title: "mkeiitmods unresponsive",
      message: "mkeiitmods appears to be frozen",
      detail: undefined,
      buttons: ["Restart mkeiitmods", "Quit"],
    });

    dialog.showMessageBoxSync({ message: "Vortex is already running", detail: "x" });
    expect(calls.messageBoxSync).toHaveBeenCalledWith(
      expect.objectContaining({ message: "mkeiitmods is already running", detail: "x" }),
    );
  });
});
