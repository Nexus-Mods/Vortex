import type Nexus from "@nexusmods/nexus-api";
import PromiseBB from "bluebird";
import { describe, expect, vi } from "vitest";

import { makeGameStored, makeMod, makeProfile } from "@/test-utils/builders";
import { type IHarnessFixtures, test } from "@/test-utils/harnessTest";
import type { IApiHarness } from "@/test-utils/harnessTypes";

import { endorseThing } from "./util";
import { endorseCollection, endorseMod } from "./util/endorseMod";

vi.mock("./util/endorseMod", () => ({ endorseMod: vi.fn(), endorseCollection: vi.fn() }));

const nexus = {} as Nexus;

/** Skyrim VR managed, with a mod downloaded for Skyrim SE, so the two games differ. */
const setup = (makeApi: IHarnessFixtures["makeApi"], attributes: Record<string, unknown>) =>
  makeApi({
    activeProfileId: "profile-1",
    profiles: { "profile-1": makeProfile({ gameId: "skyrimvr" }) },
    knownGames: [
      makeGameStored(),
      makeGameStored({ id: "skyrimvr", details: { nexusPageId: "skyrimspecialedition" } }),
    ],
    mods: {
      skyrimvr: { "mod-1": makeMod({ attributes: { downloadGame: "skyrimse", ...attributes } }) },
    },
  });

const endorsedOf = (harness: IApiHarness) =>
  harness.getState().persistent.mods.skyrimvr["mod-1"].attributes.endorsed;

describe("endorseThing", () => {
  test("marks a mod pending under the managed game, where the mod is", ({ makeApi }) => {
    vi.mocked(endorseMod).mockReturnValue(new PromiseBB(() => undefined));
    const harness = setup(makeApi, { modId: 42, version: "1.0", endorsed: "Undecided" });

    endorseThing(harness.api, nexus, "skyrimse", "mod-1", "Undecided");

    expect(endorsedOf(harness)).toBe("pending");
  });

  test("marks a collection pending under the managed game, where it is", ({ makeApi }) => {
    vi.mocked(endorseCollection).mockReturnValue(new PromiseBB(() => undefined));
    const harness = setup(makeApi, { collectionId: 7, endorsed: "Undecided" });

    endorseThing(harness.api, nexus, "skyrimse", "mod-1", "Undecided");

    expect(endorsedOf(harness)).toBe("pending");
  });

  test("puts back the status from before the request when it fails", async ({ makeApi }) => {
    vi.mocked(endorseMod).mockReturnValue(PromiseBB.reject(new Error("offline")));
    const harness = setup(makeApi, { modId: 42, version: "1.0", endorsed: "Endorsed" });

    endorseThing(harness.api, nexus, "skyrimse", "mod-1", "Endorsed");

    await vi.waitFor(() => expect(endorsedOf(harness)).toBe("Endorsed"));
  });
});
