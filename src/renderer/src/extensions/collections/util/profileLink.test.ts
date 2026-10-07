import { VortexModId, VortexProfileId } from "@vortex/shared";
import { describe, expect, it } from "vitest";

import { makeInstalledCollection, makeMod } from "../../../test-utils/builders";
import type { IMod } from "../../mod_management/types/IMod";
import { findLinkedCollection, profileCollectionTarget, profileLinkChanges } from "./profileLink";
import { makeCollectionId } from "./transformCollection";

const PROFILE_A = VortexProfileId("profile-a");
const PROFILE_B = VortexProfileId("profile-b");
const CLONE = VortexModId("clone");
const OLD = VortexModId("old");
const NEW = VortexModId("new");
const SHARED = VortexModId("shared");
const CONVENTIONAL_A = VortexModId(makeCollectionId(PROFILE_A));

const editable = (id: VortexModId, associatedProfile?: VortexProfileId): IMod =>
  makeInstalledCollection({ id, attributes: { editable: true, associatedProfile } });

const modsOf = (...mods: IMod[]): Record<VortexModId, IMod> =>
  Object.fromEntries(mods.map((mod) => [mod.id, mod]));

describe("findLinkedCollection", () => {
  it("finds the editable collection linked to the profile", () => {
    const linked = editable(CLONE, PROFILE_A);

    expect(findLinkedCollection(modsOf(editable(OLD), linked), PROFILE_A)).toBe(linked);
  });

  it("finds the profile's own collection by its conventional id", () => {
    const own = editable(CONVENTIONAL_A);

    expect(findLinkedCollection(modsOf(own), PROFILE_A)).toBe(own);
  });

  it("prefers a link the user made over the conventional collection", () => {
    const linked = editable(CLONE, PROFILE_A);

    expect(findLinkedCollection(modsOf(editable(CONVENTIONAL_A), linked), PROFILE_A)).toBe(linked);
  });

  it("leaves out a conventional collection the user linked to another profile", () => {
    const given = editable(CONVENTIONAL_A, PROFILE_B);

    expect(findLinkedCollection(modsOf(given), PROFILE_A)).toBeUndefined();
    expect(findLinkedCollection(modsOf(given), PROFILE_B)).toBe(given);
  });

  it("leaves out collections the user cannot edit", () => {
    const installed = makeInstalledCollection({
      id: "installed",
      attributes: { associatedProfile: PROFILE_A },
    });

    expect(
      findLinkedCollection(modsOf(installed, makeMod({ id: "plain-mod" })), PROFILE_A),
    ).toBeUndefined();
  });

  it("finds nothing for a profile without a collection", () => {
    expect(findLinkedCollection(modsOf(editable(CLONE)), PROFILE_A)).toBeUndefined();
  });
});

describe("profileCollectionTarget", () => {
  it("updates the collection the user linked to the profile", () => {
    const linked = editable(CLONE, PROFILE_A);

    expect(profileCollectionTarget(modsOf(linked), PROFILE_A)).toEqual({ mod: linked, id: CLONE });
  });

  it("creates the profile's collection under its conventional id", () => {
    expect(profileCollectionTarget(modsOf(), PROFILE_A)).toEqual({
      mod: undefined,
      id: CONVENTIONAL_A,
    });
  });

  it("creates under a fresh id when the conventional one belongs to another profile", () => {
    const target = profileCollectionTarget(modsOf(editable(CONVENTIONAL_A, PROFILE_B)), PROFILE_A);

    expect(target.mod).toBeUndefined();
    expect(target.id).not.toBe(CONVENTIONAL_A);
    expect(target.id.startsWith(makeCollectionId(`${PROFILE_A}_`))).toBe(true);
  });
});

describe("profileLinkChanges", () => {
  it("links the chosen collection to the profile", () => {
    expect(profileLinkChanges(modsOf(editable(CLONE)), PROFILE_A, CLONE)).toEqual([
      { collectionId: CLONE, associatedProfile: PROFILE_A },
    ]);
  });

  it("moves the profile off the collection it was linked to before", () => {
    const mods = modsOf(editable(OLD, PROFILE_A), editable(NEW));

    expect(profileLinkChanges(mods, PROFILE_A, NEW)).toEqual([
      { collectionId: OLD, associatedProfile: undefined },
      { collectionId: NEW, associatedProfile: PROFILE_A },
    ]);
  });

  it("takes a collection over from the profile it was linked to", () => {
    expect(profileLinkChanges(modsOf(editable(SHARED, PROFILE_B)), PROFILE_A, SHARED)).toEqual([
      { collectionId: SHARED, associatedProfile: PROFILE_A },
    ]);
  });

  it("unlinks the collection the profile was linked to", () => {
    expect(profileLinkChanges(modsOf(editable(OLD, PROFILE_A)), PROFILE_A, undefined)).toEqual([
      { collectionId: OLD, associatedProfile: undefined },
    ]);
  });

  it("keeps the profile's conventional collection as it is when linking another", () => {
    const mods = modsOf(editable(CONVENTIONAL_A), editable(CLONE));

    expect(profileLinkChanges(mods, PROFILE_A, CLONE)).toEqual([
      { collectionId: CLONE, associatedProfile: PROFILE_A },
    ]);
  });
});
