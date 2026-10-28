import { QueryClient, skipToken } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getModById: vi.fn() }));

vi.mock("../../nexusV3Client", () => ({
  createVortexNexusV3Client: () => ({ getModById: mocks.getModById }),
}));

import type { IExtensionApi } from "@/types/IExtensionContext";
import { queryClient } from "@/util/queryClient";

import { modKeys, modQuery } from "./mod.query";

const api = {} as IExtensionApi;

const client = () => new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });

describe("modQuery", () => {
  it("asks for the mod by its id, and returns the API's result", async () => {
    const mod = { id: "7318624273618", name: "SkyUI" };
    mocks.getModById.mockResolvedValue(mod);

    const result = await client().query(modQuery(api, "7318624273618"));

    expect(mocks.getModById).toHaveBeenCalledWith("7318624273618");
    expect(result).toEqual(mod);
  });

  it("keys each mod by its id, under every mod's key", () => {
    expect(modQuery(api, "7318624273618").queryKey).toEqual([...modKeys.all, "7318624273618"]);
  });

  it("asks for nothing when it's skipped", () => {
    expect(modQuery(api, skipToken).queryFn).toBe(skipToken);
  });
});
