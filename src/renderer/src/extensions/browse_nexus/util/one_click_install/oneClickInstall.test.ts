import { matchMutation, MutationCache, QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { oneClickFileInstallKey, oneClickInstallKey } from "./oneClickInstall";

/** A mutation under `mutationKey`, as React Query sees it when matching filters. */
const mutationUnder = (mutationKey: readonly unknown[]) =>
  new MutationCache().build(new QueryClient(), { mutationKey });

describe("oneClickInstallKey", () => {
  it("doesn't match a file's install, so the details' button ignores the picker's cards", () => {
    const card = mutationUnder(oneClickFileInstallKey({ modId: "1704-12604", fileId: 42 }));

    expect(matchMutation({ mutationKey: oneClickInstallKey("1704-12604") }, card)).toBe(false);
  });

  it("matches the mod's own install", () => {
    const details = mutationUnder(oneClickInstallKey("1704-12604"));

    expect(matchMutation({ mutationKey: oneClickInstallKey("1704-12604") }, details)).toBe(true);
  });
});

describe("oneClickFileInstallKey", () => {
  it("doesn't match another file of the same mod", () => {
    const other = mutationUnder(oneClickFileInstallKey({ modId: "1704-12604", fileId: 43 }));
    const key = oneClickFileInstallKey({ modId: "1704-12604", fileId: 42 });

    expect(matchMutation({ mutationKey: key }, other)).toBe(false);
  });
});
