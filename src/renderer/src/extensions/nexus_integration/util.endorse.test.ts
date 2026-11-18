import type Nexus from "@nexusmods/nexus-api";
import PromiseBB from "bluebird";
import { beforeEach, describe, expect, vi } from "vitest";

import { makeGameStored, makeMod, makeProfile } from "@/test-utils/builders";
import { type IHarnessFixtures, test } from "@/test-utils/harnessTest";
import type { IApiHarness } from "@/test-utils/harnessTypes";

import { endorseThing } from "./util";
import { endorseCollection, endorseMod } from "./util/endorseMod";

vi.mock("./util/endorseMod", () => ({ endorseMod: vi.fn(), endorseCollection: vi.fn() }));

const nexus = {} as Nexus;

/**
 * Skyrim VR managed, with a mod downloaded for Skyrim SE, so the two games differ. VR gets a Nexus
 * domain of its own here, so a test can tell which game Nexus is asked about.
 */
const setup = (makeApi: IHarnessFixtures["makeApi"], attributes: Record<string, unknown>) =>
  makeApi({
    activeProfileId: "profile-1",
    profiles: { "profile-1": makeProfile({ gameId: "skyrimvr" }) },
    knownGames: [
      makeGameStored(),
      makeGameStored({ id: "skyrimvr", details: { nexusPageId: "skyrimvr" } }),
    ],
    mods: {
      skyrimvr: { "mod-1": makeMod({ attributes: { downloadGame: "skyrimse", ...attributes } }) },
    },
  });

const endorsedOf = (harness: IApiHarness) =>
  harness.getState().persistent.mods.skyrimvr["mod-1"].attributes.endorsed;

/** A request that fails only when the test says so. */
const failLater = () => {
  let fail: (err: Error) => void = () => undefined;
  const request = new PromiseBB<never>((_resolve, reject) => {
    fail = reject;
  });
  return { request, fail: (err: Error) => fail(err) };
};

/** A failure `reportEndorseError` shows through `showErrorNotification`, which the harness records. */
const offline = () => new Error("getaddrinfo ENOTFOUND api.nexusmods.com");

describe("endorseThing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("marks a mod pending under the managed game, and asks about the game it was downloaded for", ({
    makeApi,
  }) => {
    vi.mocked(endorseMod).mockReturnValue(new PromiseBB(() => undefined));
    const harness = setup(makeApi, { modId: 42, version: "1.0", endorsed: "Undecided" });

    endorseThing(harness.api, nexus, "skyrimse", "mod-1", "Undecided");

    expect(endorsedOf(harness)).toBe("pending");
    expect(endorseMod).toHaveBeenCalledWith(nexus, "skyrimspecialedition", 42, "1.0", "Undecided");
  });

  test("marks a collection pending under the managed game, and asks about the game it was downloaded for", ({
    makeApi,
  }) => {
    vi.mocked(endorseCollection).mockReturnValue(new PromiseBB(() => undefined));
    const harness = setup(makeApi, { collectionId: 7, endorsed: "Undecided" });

    endorseThing(harness.api, nexus, "skyrimse", "mod-1", "Undecided");

    expect(endorsedOf(harness)).toBe("pending");
    expect(endorseCollection).toHaveBeenCalledWith(nexus, "skyrimspecialedition", 7, "Undecided");
  });

  test("puts a mod's status from before the request back when it fails", async ({ makeApi }) => {
    vi.mocked(endorseMod).mockReturnValue(PromiseBB.reject(offline()));
    const harness = setup(makeApi, { modId: 42, version: "1.0", endorsed: "Endorsed" });

    endorseThing(harness.api, nexus, "skyrimse", "mod-1", "Endorsed");

    await vi.waitFor(() => expect(endorsedOf(harness)).toBe("Endorsed"));
  });

  test("puts a collection's status from before the request back when it fails", async ({
    makeApi,
  }) => {
    vi.mocked(endorseCollection).mockReturnValue(PromiseBB.reject(offline()));
    const harness = setup(makeApi, { collectionId: 7, endorsed: "Endorsed" });

    endorseThing(harness.api, nexus, "skyrimse", "mod-1", "Endorsed");

    await vi.waitFor(() => expect(endorsedOf(harness)).toBe("Endorsed"));
  });

  test("leaves an answer a refresh wrote alone when the request fails late", async ({
    makeApi,
  }) => {
    const { request, fail } = failLater();
    vi.mocked(endorseMod).mockReturnValue(request);
    const harness = setup(makeApi, { modId: 42, version: "1.0", endorsed: "Undecided" });

    endorseThing(harness.api, nexus, "skyrimse", "mod-1", "Undecided");
    harness.setState((draft) => {
      draft.persistent.mods.skyrimvr["mod-1"].attributes.endorsed = "Endorsed";
    });
    fail(offline());

    await vi.waitFor(() => expect(harness.errorNotifications).toHaveLength(1));
    expect(endorsedOf(harness)).toBe("Endorsed");
  });
});
