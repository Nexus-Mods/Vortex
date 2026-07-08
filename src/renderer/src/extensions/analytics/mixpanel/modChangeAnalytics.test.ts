/**
 * Tests for the mod enable/disable/remove analytics. The emit helpers resolve identity from the
 * mod's own Nexus attributes and gate out collections and non-Nexus (bundled/local) mods; the
 * exported onRemoveMods is driven end to end to prove the removal reason threads onto mods_removed.
 */
import { expect } from "vitest";

import { makeMod, makeProfile, makeProfileMod } from "../../../test-utils/builders";
import type { IModChangeHarness } from "../../../test-utils/harnessTypes";
import { test } from "../../../test-utils/modChangeTest";
import type InstallManager from "../../mod_management/InstallManager";
import type { IMod } from "../../mod_management/types/IMod";
import type { IProfileMod } from "../../profile_management/types/IProfile";
import { emitModRemoved, emitModStateChanged } from "./modChangeAnalytics";

const GAME = "skyrimse";
const MOD = "mod-1";
const PROFILE = "prof-1";
const NEXUS_ATTRS = { source: "nexus", modId: 100, fileId: 200, downloadGame: GAME };

const nexusMod = (attributeOverrides: Record<string, unknown> = {}): IMod =>
  makeMod({ id: MOD, attributes: { ...NEXUS_ATTRS, ...attributeOverrides } });

const seed = (mod: IMod) => ({ mods: { [GAME]: { [MOD]: mod } } });

// Seed the mod's state in the game's active profile, so a change can measure how long it had
// spent in the prior state (enabledTime for a disable, disabledTime for an enable).
const seedModState = (h: IModChangeHarness, modState: Partial<IProfileMod>) =>
  h.setState((draft) => {
    draft.settings.profiles.lastActiveProfile[GAME] = PROFILE;
    draft.persistent.profiles[PROFILE] = makeProfile({
      id: PROFILE,
      gameId: GAME,
      modState: { [MOD]: makeProfileMod(modState) },
    });
  });

test("emitModStateChanged emits mods_state_changed with the change, reason and Nexus identity", ({
  makeModChange,
}) => {
  const h = makeModChange(seed(nexusMod()));
  emitModStateChanged(h.api, GAME, MOD, "enabled", "user_manual");
  expect(h.mixpanelEvents).toHaveLength(1);
  expect(h.mixpanelEvents[0].eventName).toBe("mods_state_changed");
  expect(h.mixpanelEvents[0].properties).toMatchObject({
    change: "enabled",
    reason: "user_manual",
    mod_id: "100",
    file_id: "200",
    collection_id: null,
  });
});

test("carries a disabled change with the supplied reason and collection id", ({
  makeModChange,
}) => {
  const h = makeModChange(seed(nexusMod()));
  emitModStateChanged(h.api, GAME, MOD, "disabled", "variant_replace", "col-1");
  expect(h.mixpanelEvents[0].properties).toMatchObject({
    change: "disabled",
    reason: "variant_replace",
    collection_id: "col-1",
  });
});

test("a disable reports how long the mod had been enabled as duration_ms", ({ makeModChange }) => {
  const h = makeModChange(seed(nexusMod()));
  seedModState(h, { enabled: true, enabledTime: Date.now() - 60_000 });
  emitModStateChanged(h.api, GAME, MOD, "disabled", "user_manual");
  expect(h.mixpanelEvents[0].properties.duration_ms).toBeGreaterThanOrEqual(60_000);
});

test("an enable reports how long the mod had been disabled as duration_ms", ({ makeModChange }) => {
  const h = makeModChange(seed(nexusMod()));
  seedModState(h, { enabled: false, disabledTime: Date.now() - 60_000 });
  emitModStateChanged(h.api, GAME, MOD, "enabled", "user_manual");
  expect(h.mixpanelEvents[0].properties.duration_ms).toBeGreaterThanOrEqual(60_000);
});

test("reports duration_ms 0 when the prior-state timestamp is unknown", ({ makeModChange }) => {
  const h = makeModChange(seed(nexusMod()));
  seedModState(h, { enabled: false }); // never disabled with a stamp -> unknown
  emitModStateChanged(h.api, GAME, MOD, "enabled", "user_manual");
  expect(h.mixpanelEvents[0].properties.duration_ms).toBe(0);
});

test("does not emit for a non-Nexus (bundled/local) mod", ({ makeModChange }) => {
  const h = makeModChange(seed(nexusMod({ source: "user-generated" })));
  emitModStateChanged(h.api, GAME, MOD, "enabled", "user_manual");
  expect(h.mixpanelEvents).toHaveLength(0);
});

test("does not emit when the mod has no Nexus file id", ({ makeModChange }) => {
  const h = makeModChange(seed(nexusMod({ fileId: undefined })));
  emitModStateChanged(h.api, GAME, MOD, "enabled", "user_manual");
  expect(h.mixpanelEvents).toHaveLength(0);
});

test("does not emit for an unknown mod id", ({ makeModChange }) => {
  const h = makeModChange(seed(nexusMod()));
  emitModStateChanged(h.api, GAME, "does-not-exist", "enabled", "user_manual");
  expect(h.mixpanelEvents).toHaveLength(0);
});

test("emitModRemoved emits mods_removed with the reason and will_be_replaced", ({
  makeModChange,
}) => {
  const h = makeModChange();
  emitModRemoved(h.api, nexusMod(), "collection_uninstall", true);
  expect(h.mixpanelEvents).toHaveLength(1);
  expect(h.mixpanelEvents[0].eventName).toBe("mods_removed");
  expect(h.mixpanelEvents[0].properties).toMatchObject({
    reason: "collection_uninstall",
    will_be_replaced: true,
    mod_id: "100",
  });
});

test("emitModRemoved does not emit for a non-Nexus mod", ({ makeModChange }) => {
  const h = makeModChange();
  emitModRemoved(
    h.api,
    makeMod({ id: MOD, attributes: { source: "user-generated" } }),
    "user_manual",
    false,
  );
  expect(h.mixpanelEvents).toHaveLength(0);
});

test("onRemoveMods threads the removal reason onto mods_removed", async ({ makeModChange }) => {
  const { onRemoveMods } = await import("../../mod_management/eventHandlers");
  // no installationPath -> undeploy filters it out and the fs removal branch is skipped
  const mod = nexusMod();
  mod.installationPath = undefined;
  const h = makeModChange(seed(mod));
  const installManager = { markRecentRemoval: () => undefined } as unknown as InstallManager;

  await new Promise<void>((resolve) =>
    onRemoveMods(h.api, [], installManager, GAME, [MOD], () => resolve(), {
      reason: "collection_uninstall",
    }),
  );

  const removed = h.mixpanelEvents.filter((e) => e.eventName === "mods_removed");
  expect(removed).toHaveLength(1);
  expect(removed[0].properties).toMatchObject({
    reason: "collection_uninstall",
    mod_id: "100",
  });
});
