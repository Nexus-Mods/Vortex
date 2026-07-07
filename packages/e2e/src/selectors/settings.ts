import type { Locator, Page } from "@playwright/test";

/** Labels of the three toggles in the Interface tab's "Automation" section. */
export const AUTOMATION_LABELS = {
  deploy: "Deploy Mods when Enabled",
  install: "Install Mods when downloaded",
  enable: "Enable Mods when installed (in current profile)",
} as const;

export class SettingsPage {
  readonly page: Page;
  readonly languageLabel: Locator;
  readonly languageSelect: Locator;
  readonly checkboxes: Locator;
  readonly darkThemeLabel: Locator;

  // Tab locators
  readonly interfaceTab: Locator;
  readonly vortexTab: Locator;
  readonly modsTab: Locator;
  readonly downloadTab: Locator;
  readonly workaroundsTab: Locator;
  readonly themeTab: Locator;

  constructor(page: Page) {
    this.page = page;
    this.languageLabel = page.getByText("Language").first();
    this.languageSelect = page.getByRole("combobox", { name: "Language" });
    this.checkboxes = page.getByRole("checkbox");
    this.darkThemeLabel = page.getByText("Dark theme").first();

    this.interfaceTab = page.getByText("Interface", { exact: true }).first();
    this.vortexTab = page.getByText("Vortex", { exact: true }).first();
    this.modsTab = page.getByText("Mods", { exact: true }).first();
    this.downloadTab = page.getByText("Download", { exact: true }).first();
    this.workaroundsTab = page.getByText("Workarounds", { exact: true }).first();
    this.themeTab = page.getByText("Theme", { exact: true }).first();
  }

  tabByName(name: string): Locator {
    return this.page.getByText(name, { exact: true }).first();
  }

  /**
   * A toggle in the Interface tab's "Automation" section, by its label
   * (see AUTOMATION_LABELS). Identity comes from the visible label text via
   * `.filter({ hasText })`; the container/state fall back to CSS classes only
   * because the `Toggle` control (src/renderer/src/controls/Toggle.tsx) exposes
   * no accessible semantics — no role, aria-label, aria-checked, or testid — so
   * getByRole/getByLabel/getByTestId can't target it and its on/off state is
   * expressed solely via the `.toggle` element's `toggle-on` / `toggle-off`
   * class (asserted with toHaveClass).
   *
   * Proper long-term fix is app-side: give Toggle `role="switch"` +
   * `aria-checked`, then this becomes `getByRole("switch", { name: label })`
   * with `toBeChecked()` assertions.
   */
  automationToggle(label: string): Locator {
    return this.page.locator(".toggle-container").filter({ hasText: label }).locator(".toggle");
  }
}
