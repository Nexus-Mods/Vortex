import { type ElectronApplication } from "@playwright/test";

/**
 * Keep the E2E-launched Vortex from taking over the OS `nxm://` protocol
 * association. On a dev machine with Vortex installed, registering it would
 * hijack the nxm:// hand-off the download specs must capture inside the test
 * browser — and clobber the developer's real Vortex registration. In-app nxm
 * handling (the "external-url" IPC) is unaffected, so forwarded downloads still
 * install.
 *
 * The renderer registers the protocol through the "app:setProtocolClient" IPC,
 * which calls app.setAsDefaultProtocolClient. We patch that main-process method
 * to clear the association instead of setting it — the same test-side approach
 * installExternalOpenSpy uses for shell.openExternal, so no E2E-only branch is
 * needed in production. Call once per launch, before the renderer's (deferred)
 * registration runs; the vortexApp fixture does so right after launch.
 */
export async function neutralizeOsProtocolRegistration(
  vortexApp: ElectronApplication,
): Promise<void> {
  await vortexApp.evaluate(({ app }) => {
    const proto = app as unknown as {
      setAsDefaultProtocolClient: (protocol: string, path?: string, args?: string[]) => boolean;
      removeAsDefaultProtocolClient: (protocol: string, path?: string, args?: string[]) => boolean;
    };
    const remove = proto.removeAsDefaultProtocolClient.bind(app);
    proto.setAsDefaultProtocolClient = (protocol, path, args) => {
      remove(protocol, path, args);
      return false;
    };
  });
}
