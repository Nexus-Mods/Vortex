import { describe, expect, it } from "vitest";

import { makeGameHarness, makeInstalledCollection } from "../../../test-utils/builders";
import { createCollectionFromProfile } from "./createCollectionFromProfile";
import { makeCollectionId } from "./transformCollection";

const PROFILE_ID = "profile-1";

describe("createCollectionFromProfile", () => {
  it("names an updated collection as the mods page shows it", async () => {
    const collection = makeInstalledCollection({
      id: makeCollectionId(PROFILE_ID),
      attributes: { editable: true, customFileName: "My Collection" },
    });
    const harness = makeGameHarness({
      profileId: PROFILE_ID,
      mods: { [collection.id]: collection },
    });

    const result = await createCollectionFromProfile(harness.api, PROFILE_ID);

    expect(result).toMatchObject({ updated: true, name: "My Collection" });
  });
});
