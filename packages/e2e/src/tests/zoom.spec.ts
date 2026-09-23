/// <reference lib="dom" />

import { test, expect } from "../fixtures/vortex-app";

test.describe("Modern zoom, signed out", () => {
  test.use({ nexusUser: null });

  test("keeps chrome fixed on every frame while scaling up", async ({ vortexWindow }) => {
    await expect(vortexWindow.getByTestId("window-titlebar")).toBeVisible();
    for (let step = 0; step < 5; step++) await vortexWindow.keyboard.press("Control+-");
    await expect(vortexWindow.getByTestId("zoom-popover")).toContainText("50%");
    const samplesPromise = vortexWindow.evaluate(async () => {
      const frames: number[][] = [];
      const start = performance.now();
      while (performance.now() - start < 2200) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        frames.push(
          ["window-titlebar", "zoom-control", "zoom-popover"].flatMap((id) => {
            const rect = document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
            return [rect.x, rect.y, rect.width, rect.height];
          }),
        );
      }
      return frames;
    });
    for (let step = 0; step < 10; step++) {
      await vortexWindow.keyboard.press("Control+=");
      await vortexWindow.waitForTimeout(100);
    }
    const frames = await samplesPromise;
    expect(frames.length).toBeGreaterThan(10);
    const baseline = frames[0]!;
    expect(
      Math.max(
        ...frames.flatMap((frame) =>
          frame.map((value, index) => Math.abs(value - baseline[index]!)),
        ),
      ),
    ).toBeLessThan(2);
    await expect(vortexWindow.getByTestId("zoom-popover")).toContainText("150%");
  });

  test("shortcuts, fixed title bar, reset timer, and saved zoom", async ({ vortexWindow }) => {
    const titlebar = vortexWindow.getByTestId("window-titlebar");
    const trigger = vortexWindow.getByTestId("zoom-control");
    const popup = vortexWindow.getByTestId("zoom-popover");
    await expect(titlebar).toBeVisible();
    await expect(vortexWindow.getByRole("button", { name: "Log in", exact: true })).toBeVisible();
    await expect(trigger).toHaveCount(0);
    const before = await titlebar.boundingBox();

    await vortexWindow.keyboard.press("Control+=");
    await expect(popup).toContainText("110%");
    await vortexWindow.keyboard.press("Control+-");
    await expect(popup).toContainText("100%");
    await vortexWindow.locator("body").hover();
    await vortexWindow.keyboard.down("Control");
    try {
      await vortexWindow.mouse.wheel(0, -120);
    } finally {
      await vortexWindow.keyboard.up("Control");
    }
    await expect(popup).toContainText("110%");
    const after = await titlebar.boundingBox();
    for (const key of ["x", "y", "width", "height"] as const) {
      expect(Math.abs(after![key] - before![key])).toBeLessThan(2);
    }

    await popup.getByRole("button", { name: "Zoom in", exact: true }).click();
    await expect(popup).toContainText("120%");
    await popup.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(popup).toContainText("100%");
    // An explicit wait verifies the popup survives the old early-dismissal bug.
    await vortexWindow.waitForTimeout(2500);
    await expect(popup).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(popup).toHaveCount(0, { timeout: 1500 });
    await expect(trigger).toHaveCount(0);

    await vortexWindow.keyboard.press("Control+-");
    await expect(popup).toContainText("90%");
    await vortexWindow.reload();
    await expect(titlebar).toBeVisible({ timeout: 60_000 });
    await expect(trigger).toHaveAttribute("aria-label", "Zoom: 90%");
    await trigger.click();
    await expect(popup).toContainText("90%");
    await popup.getByRole("button", { name: "Zoom in", exact: true }).click();
    await expect(popup).toContainText("100%");
    await vortexWindow.waitForTimeout(2500);
    await expect(popup).toBeVisible();
    await expect(popup).toHaveCount(0, { timeout: 1500 });
  });
});
