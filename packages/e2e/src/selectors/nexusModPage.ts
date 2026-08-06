import type { Locator, Page } from "@playwright/test";

// Nexus labels the manual button just "MANUAL" (its mod-manager pair is named
// "Mod Manager Download" and "Vortex" — different convention).
export class NexusModPage {
  readonly page: Page;
  readonly manualDownloadLink: Locator;
  readonly slowDownloadButton: Locator;
  /**
   * Mod-manager download trigger. Rendered as a "Mod manager download" control
   * (a button on the Files tab, a link elsewhere) or, for premium on some pages,
   * a "Vortex" button — match the name across either role.
   */
  readonly modManagerDownload: Locator;
  /**
   * The "Download mod file" confirmation modal that appears when a mod declares
   * file-level requirements. Mods without requirements skip it and fire nxm://
   * straight away.
   */
  readonly downloadModal: Locator;
  /** The modal's primary main-file "Download" action (an anchor, sometimes a button). */
  readonly modalDownloadLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.manualDownloadLink = page.getByRole("link", { name: /^manual( download)?$/i }).first();
    this.slowDownloadButton = page.getByRole("button", { name: "Slow download" }).first();
    this.modManagerDownload = page
      .getByRole("button", { name: /mod manager download|^vortex$/i })
      .or(page.getByRole("link", { name: /mod manager download|vortex/i }))
      .first();
    // Anchor on the modal's own copy ("Download mod file" heading / "Mod file
    // requirements" section) rather than a generic .modal/.popup union, which on
    // a mod page can latch onto an unrelated hidden element and miss the real one.
    this.downloadModal = page
      .getByRole("dialog")
      .filter({ hasText: /Download mod file|Mod file requirements/i })
      .first();
    // The primary action downloads the main file only: its accessible name is
    // exactly "Download". The per-requirement rows use icon-only controls (no
    // "Download" name), so they're excluded — leaving the required mods absent
    // for the Health Check to flag.
    this.modalDownloadLink = this.downloadModal
      .getByRole("link", { name: /^download$/i })
      .or(this.downloadModal.getByRole("button", { name: /^download$/i }))
      .first();
  }
}
