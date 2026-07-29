import type { Locator, Page } from "@playwright/test";

/**
 * Health Check page — the per-game main page registered by the health_check
 * extension. Reached from the sidebar entry titled "Health check" (lower-case
 * "c", distinct from the "Health Check" page heading).
 */
export class HealthCheckPage {
  readonly page: Page;
  readonly root: Locator;
  readonly title: Locator;
  readonly betaBadge: Locator;
  readonly subtitle: Locator;
  readonly refreshButton: Locator;
  readonly settingsButton: Locator;
  readonly lastUpdated: Locator;
  readonly emptyStateTitle: Locator;
  readonly emptyStateMessage: Locator;
  readonly premiumBanner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator("#health-check-page");
    // Page heading (PageHeader renders the title as an <h2>). Capitalised
    // "Health Check" distinguishes it from both the lower-case "Health check"
    // sidebar entry and the "Health check passed" empty-state title.
    this.title = this.root.getByRole("heading", { name: "Health Check" });
    // "Beta" pill next to the title (BetaBadge → common:::beta).
    this.betaBadge = this.root.getByText("Beta", { exact: true });
    this.subtitle = this.root.getByText(
      "Review your Loadout for any issues and learn how to resolve them if needed.",
    );
    // Icon-only header buttons; their accessible name comes from the `title` prop.
    this.refreshButton = this.root.getByRole("button", { name: "Refresh" });
    this.settingsButton = this.root.getByRole("button", { name: "Settings" });
    this.lastUpdated = this.root.getByText(/Last updated:/);
    this.emptyStateTitle = this.root.getByText("Health check passed");
    this.emptyStateMessage = this.root.getByText("Ready for gaming");
    // Free-user upsell banner; the "<premiumLink>Go premium</premiumLink>" is a
    // separate node, so match on the leading sentence only.
    this.premiumBanner = this.root.getByText(
      "Download requirements in 1-click. No page visits or waiting.",
    );
  }
}

/**
 * File-requirement warnings as they appear in the Health Check *list*. A missing
 * required mod renders a row titled "Missing required mod for: <source mod>" with
 * the required mod's name and a "1-click install" action (see
 * components/file_requirement/ListingRow.tsx + hooks/useReportCopy.ts).
 */
export class HealthCheckWarnings {
  readonly page: Page;
  readonly root: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator("#health-check-page");
  }

  /**
   * The list row for a missing-requirement warning, identified by the
   * "Missing required mod for:" title and the required mod's name (e.g. /SMAPI/i).
   * The row is a `role="button"` container; filtering by the title text excludes
   * the header/action buttons that also carry that role.
   */
  row(requiredModName: string | RegExp): Locator {
    return this.root
      .locator('[role="button"]')
      .filter({ hasText: /Missing required mod for:/ })
      .filter({ hasText: requiredModName })
      .first();
  }

  /** The single-file "1-click install" button inside a warning row. */
  installOneClick(requiredModName: string | RegExp): Locator {
    return this.row(requiredModName).getByRole("button", { name: "1-click install", exact: true });
  }
}

/**
 * The expanded Health Check detail page (HealthCheckDetailPage + the file
 * requirement DetailView). Shown after opening a warning row; replaces the list.
 */
export class HealthCheckDetail {
  readonly page: Page;
  readonly root: Locator;
  readonly warningTitle: Locator;
  readonly backButton: Locator;
  readonly requiresFileLine: Locator;
  readonly installViaModPageButton: Locator;
  readonly installOneClickButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator("#health-check-detail-page");
    // Severity title heading ("Warning") + a "BETA" badge sit in the header.
    this.warningTitle = this.root.getByRole("heading", { name: "Warning" });
    this.backButton = this.root.getByRole("button", { name: "Back", exact: true });
    // Detail subtitle for a single missing "download" requirement. Sourced from
    // the shared::requires_files locale key (via useReportCopy) — matched by a
    // stable substring so the trailing "additional …:" wording can't re-break it.
    this.requiresFileLine = this.root.getByText(
      /Requires 1 additional mod file to be installed to work correctly/,
    );
    this.installViaModPageButton = this.root.getByRole("button", { name: "Install via mod page" });
    this.installOneClickButton = this.root.getByRole("button", {
      name: "1-click install",
      exact: true,
    });
  }

  /** The requirement card row for a required mod (e.g. /SMAPI/i). */
  requirementCard(requiredModName: string | RegExp): Locator {
    return this.root.getByText(requiredModName).first();
  }
}

/**
 * Health Check settings section, rendered on Settings > Vortex tab
 * (see SettingsHealthCheck.tsx). The file-requirements toggle only renders when
 * the Unleash flag is present for the current user.
 */
export class HealthCheckSettings {
  readonly page: Page;
  readonly sectionTitle: Locator;
  readonly description: Locator;
  readonly modRequirementsToggle: Locator;
  readonly fileRequirementsToggle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sectionTitle = page.getByText("Health Check (Beta)", { exact: true });
    this.description = page.getByText(
      "Detect issues with your mod list and suggest fixes. More checks are coming soon.",
    );
    this.modRequirementsToggle = this.toggle("Missing mod requirements suggestions");
    this.fileRequirementsToggle = this.toggle("Missing file requirements warnings");
  }

  /**
   * The clickable `.toggle` element for a labelled Health Check toggle. Mirrors
   * SettingsPage.automationToggle: the shared Toggle control
   * (src/renderer/src/controls/Toggle.tsx) exposes no accessible role, name, or
   * checked state — identity comes from the visible label via `.filter({ hasText })`
   * and on/off state from the `toggle-on` / `toggle-off` class (assert with
   * toHaveClass). The app-side fix is to give Toggle `role="switch"` + `aria-checked`.
   */
  private toggle(label: string): Locator {
    return this.page.locator(".toggle-container").filter({ hasText: label }).locator(".toggle");
  }
}
