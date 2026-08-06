import { type ElectronApplication } from "@playwright/test";

/**
 * Spy on the main-process `shell.openExternal` so a test can observe — and
 * suppress — the URLs the app would open in the OS default browser (e.g. the
 * "Install via mod page" links). Those otherwise launch the user's real browser,
 * a detached process outside Playwright's control, so the click can't be followed.
 *
 * The renderer's opn() routes through the "shell:openUrl" IPC to main's openUrl(),
 * which calls shell.openExternal — the singleton patched here (see src/main/src/
 * open.ts). Call installExternalOpenSpy before the action, then readExternalOpens.
 */
export async function installExternalOpenSpy(vortexApp: ElectronApplication): Promise<void> {
  await vortexApp.evaluate(({ shell }) => {
    const store = globalThis as unknown as { __externalOpens?: string[] };
    store.__externalOpens = [];
    // Record and swallow: actually opening the OS browser would escape the test
    // and isn't observable anyway.
    (shell as unknown as { openExternal: (url: string) => Promise<void> }).openExternal = (
      url: string,
    ) => {
      store.__externalOpens?.push(url);
      return Promise.resolve();
    };
  });
}

/** The URLs passed to shell.openExternal since installExternalOpenSpy was called. */
export async function readExternalOpens(vortexApp: ElectronApplication): Promise<string[]> {
  return vortexApp.evaluate(
    () => (globalThis as unknown as { __externalOpens?: string[] }).__externalOpens ?? [],
  );
}
