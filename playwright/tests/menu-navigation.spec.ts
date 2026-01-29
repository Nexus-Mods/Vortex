/* eslint-disable max-lines-per-function */
import { test, expect } from "@playwright/test";
import path from "path";
import { launchVortex, closeVortex } from "../src/vortex-helpers";

const TEST_NAME = "menu-navigation";

test("can open global menu and click About", async () => {
  const { app, mainWindow, testRunDir, appProcess, pid, userDataDir } =
    await launchVortex(TEST_NAME);

  try {
    await mainWindow.screenshot({
      path: path.join(testRunDir, "01-before-menu.png"),
    });

    await mainWindow.waitForFunction(
      () => {
        return document.getElementById("btn-menu-global-icons") !== null;
      },
      { timeout: 10000 },
    );

    console.log("Clicking global menu button...");
    await mainWindow.click("#btn-menu-global-icons");

    await mainWindow.waitForTimeout(1000);
    await mainWindow.screenshot({
      path: path.join(testRunDir, "02-menu-opened.png"),
    });

    const aboutLink = await mainWindow.locator("a").filter({
      has: mainWindow.locator("div", { hasText: "About" }),
    });

    await aboutLink.click();
    await mainWindow.waitForTimeout(2000);
    await mainWindow.screenshot({
      path: path.join(testRunDir, "03-about-opened.png"),
    });

    const aboutVisible = await mainWindow.evaluate(() => {
      return (
        document.body.textContent!.toLowerCase().includes("about") ||
        document.body.textContent!.toLowerCase().includes("version")
      );
    });

    expect(aboutVisible).toBe(true);
  } finally {
    await closeVortex(app, appProcess, pid, userDataDir);
    console.log(`Test completed. Results in: ${testRunDir}`);
  }
});
