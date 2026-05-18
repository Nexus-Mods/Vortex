import type { Page } from "@playwright/test";

// Chrome has no nxm:// protocol handler in the test browser, so navigation
// silently fails and Playwright's framenavigated/popup events don't fire.
// Hook the JS entry points instead. Captured URL lands on globalThis.__capturedNxm.
export async function installNxmCapture(page: Page): Promise<void> {
  await page
    .evaluate(() => {
      const w = globalThis as unknown as {
        __capturedNxm?: string;
        open: (url?: string | URL, ...rest: unknown[]) => unknown;
        addEventListener: (type: string, fn: (e: unknown) => void, capture?: boolean) => void;
        location: {
          assign?: (url: string) => void;
          replace?: (url: string) => void;
        };
      };
      const originalOpen = w.open.bind(w);
      w.open = (url?: string | URL, ...rest: unknown[]) => {
        const s = typeof url === "string" ? url : (url?.toString() ?? "");
        if (s.startsWith("nxm:")) {
          w.__capturedNxm = s;
          return null;
        }
        return originalOpen(url as string, ...rest);
      };
      const origAssign = w.location.assign?.bind(w.location);
      if (origAssign !== undefined) {
        w.location.assign = (url: string) => {
          if (url.startsWith("nxm:")) {
            w.__capturedNxm = url;
            return;
          }
          origAssign(url);
        };
      }
      const origReplace = w.location.replace?.bind(w.location);
      if (origReplace !== undefined) {
        w.location.replace = (url: string) => {
          if (url.startsWith("nxm:")) {
            w.__capturedNxm = url;
            return;
          }
          origReplace(url);
        };
      }
      w.addEventListener(
        "click",
        (e: unknown) => {
          const target = (e as { target: { closest?: (s: string) => unknown } }).target;
          const link = target.closest?.("a") as { href?: string } | undefined;
          if (link?.href?.startsWith("nxm:") === true) {
            w.__capturedNxm = link.href;
          }
        },
        true,
      );
    })
    .catch(() => undefined);
}

// DOM scan is the fallback — the slow-download flow writes the nxm:// URL into
// the rendered DOM (anchor href / data attribute) when the countdown completes.
export async function waitForNxmUrl(page: Page, timeoutMs: number): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const hooked = await page
      .evaluate(() => (globalThis as { __capturedNxm?: string }).__capturedNxm)
      .catch(() => undefined);
    if (typeof hooked === "string" && hooked.startsWith("nxm:")) {
      return hooked;
    }
    const fromDom = await page
      .evaluate(() => {
        const doc = (globalThis as { document?: unknown }).document as {
          documentElement: { outerHTML: string };
        };
        const m = doc.documentElement.outerHTML.match(/nxm:\/\/[^"'\s<>]+/i);
        return m === null ? null : m[0];
      })
      .catch(() => null);
    if (typeof fromDom === "string" && fromDom.startsWith("nxm:")) {
      return fromDom;
    }
    await page.waitForTimeout(500).catch(() => undefined);
  }
  return null;
}
