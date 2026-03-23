import type { Locator, Page } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly whatsNew: Locator;
  readonly latestNews: Locator;
  readonly customiseButton: Locator;
  readonly doneButton: Locator;
  readonly getStartedSection: Locator;
  readonly introductionVideo: Locator;
  readonly videoCloseButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.whatsNew = page.getByText("What's New").first();
    this.latestNews = page.getByText('Latest News').first();
    this.customiseButton = page.getByText(/customi[sz]e/i).first();
    this.doneButton = page.getByText(/done/i).first();
    this.getStartedSection = page.getByText(/get.*started|introduction/i).first();
    this.introductionVideo = page.getByText(/getting started|introduction video/i).first();
    // The close button in the video modal/overlay
    this.videoCloseButton = page.locator('.modal .close, [class*="video"] [class*="close"]').first();
  }
}
