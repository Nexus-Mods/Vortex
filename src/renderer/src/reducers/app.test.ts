import { GameDomain, GameId } from "@vortex/shared";
import { describe, expect, it } from "vitest";

import * as actions from "../actions/app";
import { makeExtensionState, makeLegacyExtensionState } from "../test-utils/builders";
import { appReducer } from "./app";

// A dummy game's Nexus Mods domain and numeric id.
const domainA = GameDomain("domain-a");
const numericA = GameId(1);

describe("app reducer extension field writes", () => {
  const base = { ...appReducer.defaults, extensions: { abc123: makeExtensionState() } };
  const apply = (action: { getType: () => string }, payload: unknown) =>
    appReducer.reducers[action.getType()](base, payload);

  it("applies setExtensionEnabled to an existing entry", () => {
    const result = apply(actions.setExtensionEnabled, { extensionId: "abc123", enabled: false });
    expect(result.extensions.abc123.enabled).toBe(false);
  });

  it("applies declineExtensionNexusLink to an existing entry", () => {
    const result = apply(actions.declineExtensionNexusLink, "abc123");
    expect(result.extensions.abc123.nexusLinkDeclined).toBe(true);
  });

  it("applies setExtensionModId to an existing entry", () => {
    const result = apply(actions.setExtensionModId, { extensionId: "abc123", modId: 196 });
    expect(result.extensions.abc123.modId).toBe(196);
  });

  it("applies setExtensionNexusGame to an existing entry", () => {
    const nexus = { gameId: numericA, gameDomain: domainA };
    const result = apply(actions.setExtensionNexusGame, { extensionId: "abc123", nexus });
    expect(result.extensions.abc123.nexus).toEqual(nexus);
  });

  // a write through a key naming no entry must not mint a partial one
  it.each([
    [
      "setExtensionEnabled",
      actions.setExtensionEnabled,
      { extensionId: "missing", enabled: false },
    ],
    ["setExtensionVersion", actions.setExtensionVersion, { extensionId: "missing", version: "2" }],
    [
      "setExtensionEndorsed",
      actions.setExtensionEndorsed,
      { extensionId: "missing", endorsed: "Endorsed" },
    ],
    ["setExtensionModId", actions.setExtensionModId, { extensionId: "missing", modId: 196 }],
    [
      "setExtensionNexusGame",
      actions.setExtensionNexusGame,
      { extensionId: "missing", nexus: { gameId: numericA, gameDomain: domainA } },
    ],
    ["declineExtensionNexusLink", actions.declineExtensionNexusLink, "missing"],
    ["removeExtension", actions.removeExtension, "missing"],
  ])("ignores %s for an unknown key", (_name, action, payload) => {
    expect(apply(action, payload).extensions).toEqual(base.extensions);
  });
});

describe("app reducer forgetExtension", () => {
  const base = {
    ...appReducer.defaults,
    extensions: { "legacy-ext": makeLegacyExtensionState(), abc123: makeExtensionState() },
  };

  it("drops the entry a scan superseded, leaving the rest", () => {
    const result = appReducer.reducers[actions.forgetExtension.getType()](base, "legacy-ext");
    expect(Object.keys(result.extensions)).toEqual(["abc123"]);
  });
});
