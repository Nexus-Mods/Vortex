import { QueryClient } from "@tanstack/react-query";
import { GameDomain } from "@vortex/shared";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getModFileVersionDownloadLink: vi.fn() }));

vi.mock("../../nexusV3Client", () => ({
  createVortexNexusV3Client: () => ({
    getModFileVersionDownloadLink: mocks.getModFileVersionDownloadLink,
  }),
}));

import type { IExtensionApi } from "@/types/IExtensionContext";
import { queryClient } from "@/util/queryClient";

import {
  type IModFileDownloadLink,
  modFileDownloadLinkMutation,
} from "./modFileDownloadLink.mutation";

const api = {} as IExtensionApi;

/** Runs the mutation once, as a component's `mutate` would. */
const run = (variables: IModFileDownloadLink) => {
  const client = new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });
  return client
    .getMutationCache()
    .build(client, modFileDownloadLinkMutation(api))
    .execute(variables);
};

describe("modFileDownloadLinkMutation", () => {
  it("asks for a file version's download links as Vortex, and returns them", async () => {
    const links = { links: [{ name: "Nexus CDN", short_name: "Nexus", url: "https://cdn/f" }] };
    mocks.getModFileVersionDownloadLink.mockResolvedValue(links);

    const result = await run({
      gameDomain: GameDomain("skyrimspecialedition"),
      fileVersionId: "345678",
      collectionId: 42,
    });

    expect(mocks.getModFileVersionDownloadLink).toHaveBeenCalledWith(
      "skyrimspecialedition",
      "345678",
      { collectionId: 42, applicationName: "Vortex" },
    );
    expect(result).toEqual(links);
  });

  it("asks only once when it fails, as each ask records a download", async () => {
    mocks.getModFileVersionDownloadLink.mockReset();
    mocks.getModFileVersionDownloadLink.mockRejectedValue(new Error("Forbidden"));

    await expect(
      run({ gameDomain: GameDomain("skyrimspecialedition"), fileVersionId: "345678" }),
    ).rejects.toThrow("Forbidden");
    expect(mocks.getModFileVersionDownloadLink).toHaveBeenCalledTimes(1);
  });
});
