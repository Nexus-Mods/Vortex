import type { Locator, Page } from "@playwright/test";

/**
 * "Confirm removal" modal shown when removing a mod from the Mods list
 * (mod_management/views/ModList.tsx `removeSelected`).
 *
 * For an installed mod it offers two checkboxes: "Remove Mod" (checked) and
 * "Delete Archive" (unchecked). Once only the archive remains, it offers a
 * single "Delete Archive" checkbox, pre-checked.
 */
export class ConfirmRemovalDialog {
  readonly page: Page;
  readonly root: Locator;
  readonly removeModCheckbox: Locator;
  readonly deleteArchiveCheckbox: Locator;
  readonly cancelButton: Locator;
  readonly removeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // The modal renders nested role="dialog" wrappers; .last() picks the
    // innermost (the .modal element itself) to satisfy strict mode.
    this.root = page.getByRole("dialog").filter({ hasText: "Confirm removal" }).last();
    this.removeModCheckbox = this.root.getByRole("checkbox", { name: "Remove Mod" });
    this.deleteArchiveCheckbox = this.root.getByRole("checkbox", { name: "Delete Archive" });
    this.cancelButton = this.root.getByRole("button", { name: "Cancel" });
    this.removeButton = this.root.getByRole("button", { name: "Remove", exact: true });
  }
}
