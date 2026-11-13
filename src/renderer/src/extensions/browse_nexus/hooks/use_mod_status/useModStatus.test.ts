import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  INexusModRef,
  ModInstallState,
} from "@/extensions/browse_nexus/util/mod_install_state/modInstallState";
import {
  oneClickFileInstallsKey,
  oneClickInstallKey,
} from "@/extensions/browse_nexus/util/one_click_install/oneClickInstall";
import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";

import { useModStatus } from "./useModStatus.hook";

const mocks = vi.hoisted(() => ({
  installState: { kind: "none" } as ModInstallState,
  lookedUp: [] as INexusModRef[],
  mutatingKey: [] as unknown[],
}));

vi.mock("@tanstack/react-query", () => ({
  useIsMutating: ({ mutationKey }: { mutationKey: unknown[] }) =>
    JSON.stringify(mutationKey) === JSON.stringify(mocks.mutatingKey) ? 1 : 0,
}));
vi.mock("@/extensions/browse_nexus/hooks/use_mod_install_state/useModInstallState.hook", () => ({
  useModInstallState: (ref: INexusModRef) => {
    mocks.lookedUp.push(ref);
    return mocks.installState;
  },
}));

const MOD = {
  id: "7340033",
  game_scoped_id: "1",
  game: { domain_name: "skyrimspecialedition" },
} as unknown as ModSummary;

describe("useModStatus", () => {
  beforeEach(() => {
    mocks.installState = { kind: "downloaded", downloadId: "dl", downloadCount: 1 };
    mocks.lookedUp = [];
    mocks.mutatingKey = [];
  });

  it("looks the mod up by its game's domain and its id", () => {
    renderHook(() => useModStatus(MOD));

    expect(mocks.lookedUp[0]).toEqual({ domain: "skyrimspecialedition", modId: 1 });
  });

  it("gives what the user has of the mod, and its status", () => {
    const { result } = renderHook(() => useModStatus(MOD));

    expect(result.current).toEqual({ installState: mocks.installState, status: "downloaded" });
  });

  it("gives no status while a 1-click install of it runs", () => {
    mocks.mutatingKey = oneClickInstallKey(MOD.id);
    const { result } = renderHook(() => useModStatus(MOD));

    expect(result.current.status).toBeUndefined();
  });

  it("gives no status while a picker card's 1-click install of one of its files runs", () => {
    mocks.mutatingKey = oneClickFileInstallsKey(MOD.id);
    const { result } = renderHook(() => useModStatus(MOD));

    expect(result.current.status).toBeUndefined();
  });
});
