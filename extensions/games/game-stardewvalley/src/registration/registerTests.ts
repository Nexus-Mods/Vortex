/**
 * Registers Stardew Valley extension diagnostics with Vortex.
 */
import type { types } from "vortex-api";

import type ModManifestCache from "../manifests/ModManifestCache";
import { testSMAPIOutdated } from "../tests";

/**
 * Registers diagnostic tests used by the Stardew Valley extension.
 */
export function registerTests(
  context: types.IExtensionContext,
  modManifestCache: ModManifestCache,
) {
  context.registerTest("sdv-incompatible-mods", "gamemode-activated", () =>
    testSMAPIOutdated(context.api, modManifestCache),
  );
}
