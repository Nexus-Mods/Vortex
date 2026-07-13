import type { Locator, Page } from "@playwright/test";

export class ConfirmRemovalDialog {
  readonly page: Page;
  readonly root: Locator;
  readonly removeModCheckbox: Locator;
  readonly deleteArchiveCheckbox: Locator;
  readonly cancelButton: Locator;
  readonly removeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.getByRole("dialog").filter({ hasText: "Confirm removal" }).last();
    this.removeModCheckbox = this.root.getByRole("checkbox", { name: "Remove Mod" });
    this.deleteArchiveCheckbox = this.root.getByRole("checkbox", { name: "Delete Archive" });
    this.cancelButton = this.root.getByRole("button", { name: "Cancel" });
    this.removeButton = this.root.getByRole("button", { name: "Remove", exact: true });
  }
}
