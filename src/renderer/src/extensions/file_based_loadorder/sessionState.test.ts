import { describe, expect } from "vitest";

import { makeValidationResult } from "../../test-utils/builders";
import { test } from "../../test-utils/fbloTest";
import { fbLoadOrderTabSelected, setValidationResult } from "./actions/session";
import { activeLoadOrderIdForProfile, validationResultForLoadOrder } from "./selectors";

const invalid = makeValidationResult();

describe("the open load order tab", () => {
  test("is remembered per profile", ({ makeFblo }) => {
    const fblo = makeFblo();

    fblo.api.store.dispatch(fbLoadOrderTabSelected(fblo.profileId, "archive"));
    fblo.api.store.dispatch(fbLoadOrderTabSelected("profile-2", "redmod"));

    expect(activeLoadOrderIdForProfile(fblo.getState(), fblo.profileId)).toBe("archive");
    expect(activeLoadOrderIdForProfile(fblo.getState(), "profile-2")).toBe("redmod");
  });

  test("is unset for a profile that never picked one", ({ makeFblo }) => {
    const fblo = makeFblo();

    expect(activeLoadOrderIdForProfile(fblo.getState(), fblo.profileId)).toBeUndefined();
  });
});

describe("a validation result", () => {
  test("belongs to one load order of a profile", ({ makeFblo }) => {
    const fblo = makeFblo();

    fblo.api.store.dispatch(setValidationResult(fblo.profileId, invalid, "archive"));

    expect(validationResultForLoadOrder(fblo.getState(), fblo.profileId, "archive")).toEqual(
      invalid,
    );
    expect(validationResultForLoadOrder(fblo.getState(), fblo.profileId)).toBeUndefined();
  });

  test("set without an id belongs to the primary load order", ({ makeFblo }) => {
    const fblo = makeFblo();

    fblo.api.store.dispatch(setValidationResult(fblo.profileId, invalid));

    expect(validationResultForLoadOrder(fblo.getState(), fblo.profileId)).toEqual(invalid);
  });

  test("cleared for one load order leaves the others", ({ makeFblo }) => {
    const fblo = makeFblo();
    fblo.api.store.dispatch(setValidationResult(fblo.profileId, invalid));
    fblo.api.store.dispatch(setValidationResult(fblo.profileId, invalid, "archive"));

    fblo.api.store.dispatch(setValidationResult(fblo.profileId, undefined, "archive"));

    expect(
      validationResultForLoadOrder(fblo.getState(), fblo.profileId, "archive"),
    ).toBeUndefined();
    expect(validationResultForLoadOrder(fblo.getState(), fblo.profileId)).toEqual(invalid);
  });
});
