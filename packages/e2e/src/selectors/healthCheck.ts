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
  readonly activeTab: Locator;
  readonly hiddenTab: Locator;
  readonly installAllButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator("#health-check-page");
    this.title = this.root.getByRole("heading", { name: "Health Check" });
    this.betaBadge = this.root.getByText("Beta", { exact: true });
    this.subtitle = this.root.getByText(
      "Review your Loadout for any issues and learn how to resolve them if needed.",
    );
    this.refreshButton = this.root.getByRole("button", { name: "Refresh" });
    this.settingsButton = this.root.getByRole("button", { name: "Settings" });
    this.lastUpdated = this.root.getByText(/Last updated:/);
    this.emptyStateTitle = this.root.getByText("Health check passed");
    this.emptyStateMessage = this.root.getByText("Ready for gaming");
    this.premiumBanner = this.root.getByText(
      "Download requirements in 1-click. No page visits or waiting.",
    );
    this.activeTab = this.root.getByRole("tab", { name: /Active/ });
    this.hiddenTab = this.root.getByRole("tab", { name: /Hidden/ });
    this.installAllButton = this.root.getByRole("button", { name: /1-click install all/ });
  }
}

export class HealthCheckWarnings {
  readonly page: Page;
  readonly root: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator("#health-check-page");
  }

  row(requiredModName?: string | RegExp): Locator {
    const rows = this.root
      .locator('[role="button"]')
      .filter({ hasText: /Missing required mods? for:/ });
    return (
      requiredModName === undefined ? rows : rows.filter({ hasText: requiredModName })
    ).first();
  }

  title(requiredModName?: string | RegExp): Locator {
    return this.row(requiredModName).getByText(/Missing required mods? for:/);
  }

  installOneClick(requiredModName?: string | RegExp): Locator {
    return this.row(requiredModName).getByRole("button", { name: /1-click install/ });
  }

  pickModInstall(requiredModName?: string | RegExp): Locator {
    return this.row(requiredModName).getByRole("button", { name: "Pick mod install", exact: true });
  }

  notHelpfulButton(requiredModName?: string | RegExp): Locator {
    return this.row(requiredModName).getByRole("button", { name: "Not helpful", exact: true });
  }

  hideButton(requiredModName?: string | RegExp): Locator {
    return this.row(requiredModName).getByRole("button", { name: "Hide", exact: true });
  }

  unhideButton(requiredModName?: string | RegExp): Locator {
    return this.row(requiredModName).getByRole("button", { name: "Unhide", exact: true });
  }
}
export class HealthCheckDetail {
  readonly page: Page;
  readonly root: Locator;
  readonly warningTitle: Locator;
  readonly backButton: Locator;
  readonly installViaModPageButton: Locator;
  readonly installOneClickButton: Locator;
  readonly installRequiredHeader: Locator;
  readonly installAllInGroupButton: Locator;
  readonly pickOneHeader: Locator;
  readonly requiresPickLine: Locator;
  readonly orDivider: Locator;
  readonly feedbackPrompt: Locator;
  readonly feedbackThanks: Locator;
  readonly notHelpfulButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator("#health-check-detail-page");
    this.warningTitle = this.root.getByRole("heading", { name: "Warning" });
    this.backButton = this.root.getByRole("button", { name: "Back", exact: true });
    this.installViaModPageButton = this.root
      .getByRole("button", { name: "Install via mod page" })
      .first();
    this.installOneClickButton = this.root
      .getByRole("button", { name: /^1-click install$/ })
      .first();
    this.installRequiredHeader = this.root.getByText("Install required", { exact: true });
    this.installAllInGroupButton = this.root
      .getByRole("button", { name: /1-click install all/ })
      .first();
    this.pickOneHeader = this.root.getByText("Pick one of these", { exact: true });
    this.requiresPickLine = this.root.getByText(
      /Requires \d+ additional mod files? to be picked to work correctly/,
    );
    this.orDivider = this.root.getByText("Or", { exact: true });
    this.feedbackPrompt = this.root.getByText("Was this warning helpful?");
    this.feedbackThanks = this.root.getByText("Thanks for your feedback");
    this.notHelpfulButton = this.root.getByRole("button", { name: "Not helpful", exact: true });
  }

  requiresFileSummary(count: number): Locator {
    return this.root.getByText(
      `Requires ${count} additional mod ${count === 1 ? "file" : "files"} to be installed to work correctly`,
    );
  }

  requirementCard(requiredModName: string | RegExp): Locator {
    return this.root.getByText(requiredModName).first();
  }
}
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

  private toggle(label: string): Locator {
    return this.page.locator(".toggle-container").filter({ hasText: label }).locator(".toggle");
  }
}
export class HealthCheckPremiumModal {
  readonly page: Page;
  readonly root: Locator;
  readonly allTitle: Locator;
  readonly singleTitle: Locator;
  readonly benefitsTitle: Locator;
  readonly unlockButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.getByRole("dialog").filter({ hasText: /Skip the website and install/ });
    this.allTitle = page.getByText("Skip the website and install all requirements instantly.");
    this.singleTitle = page.getByText("Skip the website and install instantly.");
    this.benefitsTitle = this.root.getByText("With Premium you get:");
    this.unlockButton = this.root.getByRole("button", { name: "Unlock 1-click installs" });
  }
}

export class HealthCheckFeedbackModal {
  readonly page: Page;
  readonly root: Locator;
  readonly title: Locator;
  readonly incorrectRequirement: Locator;
  readonly sendButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.getByRole("dialog").filter({ hasText: "Thanks for letting us know" });
    this.title = page.getByText("Thanks for letting us know");
    this.incorrectRequirement = this.root.getByText("Incorrect requirement");
    this.sendButton = this.root.getByRole("button", { name: "Send feedback" });
  }
}

export class HealthCheckSuggestions {
  readonly page: Page;
  readonly root: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator("#health-check-page");
  }

  row(requiringModName?: string | RegExp): Locator {
    const rows = this.root
      .locator('[role="button"]')
      .filter({ hasText: /Additional mod files? may be required for:/ });
    return (
      requiringModName === undefined ? rows : rows.filter({ hasText: requiringModName })
    ).first();
  }

  title(requiringModName?: string | RegExp): Locator {
    return this.row(requiringModName).getByText(/Additional mod files? may be required for:/);
  }

  missingMod(requiringModName?: string | RegExp): Locator {
    return this.row(requiringModName).getByText(/Missing mod:/);
  }

  installOneClick(requiringModName?: string | RegExp): Locator {
    return this.row(requiringModName).getByRole("button", { name: /1-click install/ });
  }
}

export class HealthCheckSuggestionDetail {
  readonly page: Page;
  readonly root: Locator;
  readonly suggestionTitle: Locator;
  readonly mayRequireLine: Locator;
  readonly modPageSourceNote: Locator;
  readonly feedbackPrompt: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator("#health-check-detail-page");
    this.suggestionTitle = this.root.getByRole("heading", { name: "Suggestion" });
    this.mayRequireLine = this.root.getByText(
      "May require this additional mod file to be installed to work correctly",
    );
    this.modPageSourceNote = this.root.getByText(
      /identified from the mod page rather than the file-level requirement system/,
    );
    this.feedbackPrompt = this.root.getByText("Was this suggestion helpful?");
  }
}
