import type { Locator, Page } from "@playwright/test";

// Nexus labels the manual button just "MANUAL" (its mod-manager pair is named
// "Mod Manager Download" and "Vortex" — different convention).
export class NexusModPage {
  readonly page: Page;
  readonly manualDownloadLink: Locator;
  readonly slowDownloadButton: Locator;
  /**
   * Mod-manager download trigger. Free users see a "Mod manager download"
   * link; premium users see a "Vortex" button — match either role.
   */
  readonly modManagerDownload: Locator;
  /** Confirmation/requirements modal shown by some download flows. */
  readonly downloadModal: Locator;
  /** The "Download" link inside the confirmation modal (when present). */
  readonly modalDownloadLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.manualDownloadLink = page.getByRole("link", { name: /^manual( download)?$/i }).first();
    this.slowDownloadButton = page.getByRole("button", { name: "Slow download" }).first();
    this.modManagerDownload = page
      .getByRole("button", { name: /^vortex$/i })
      .or(page.getByRole("link", { name: /mod manager download|vortex/i }))
      .first();
    this.downloadModal = page.locator('.popup, .modal, [role="dialog"], #popup-content').first();
    this.modalDownloadLink = this.downloadModal.getByRole("link", { name: /^download$/i }).first();
  }
}
