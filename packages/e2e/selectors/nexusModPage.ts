import type { Locator, Page } from "@playwright/test";

// Nexus labels the manual button just "MANUAL" (its mod-manager pair is named
// "Mod Manager Download" and "Vortex" — different convention).
export class NexusModPage {
  readonly page: Page;
  readonly manualDownloadLink: Locator;
  readonly slowDownloadButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.manualDownloadLink = page.getByRole("link", { name: /^manual( download)?$/i }).first();
    this.slowDownloadButton = page.getByRole("button", { name: "Slow download" }).first();
  }
}
