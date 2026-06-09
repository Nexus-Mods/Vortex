import type { BrowserContext, Page, Route } from "@playwright/test";

/**
 * A single 1x1 transparent PNG, decoded once and reused for every intercepted
 * image request. Avoids hitting the network for mod thumbnails and similar
 * assets (e.g. https://staticdelivery.nexusmods.com/mods/.../images/...) which
 * are irrelevant to the tests, slow, and a source of flakiness.
 */
const EMPTY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64",
);

/** Hosts whose images should be stubbed with the cached empty PNG. */
const IMAGE_HOST_PATTERN = /staticdelivery\.nexusmods\.com|\.nexusmods\.com\/.*\/images\//;

function fulfillEmptyImage(route: Route): Promise<void> {
  return route.fulfill({
    status: 200,
    contentType: "image/png",
    body: EMPTY_PNG,
  });
}

/**
 * Intercept remote image requests on a page or browser context and serve a
 * single cached empty PNG instead of fetching from the server. Matches both
 * by image resource type and by known Nexus static-delivery hosts so direct
 * <img src> loads are covered too.
 */
export async function stubRemoteImages(target: Page | BrowserContext): Promise<void> {
  await target.route(
    (url) => IMAGE_HOST_PATTERN.test(url.href),
    (route) => fulfillEmptyImage(route),
  );

  await target.route("**/*", (route) => {
    if (route.request().resourceType() === "image") {
      return fulfillEmptyImage(route);
    }
    return route.fallback();
  });
}
