import type { IFileInfo } from "@nexusmods/nexus-api";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import type { IExtensionApi } from "@/types/IExtensionContext";

import { mainFilesQuery } from "./mainFiles.query";

const mod = {
  id: "mod-uid",
  game_scoped_id: "42",
  game: { domain_name: "skyrimspecialedition" },
} as ModSummary;
const file = (file_id: number, category_id: number, uploaded_timestamp: number) =>
  ({ file_id, category_id, uploaded_timestamp, is_primary: false }) as IFileInfo;

const setup = (nexusFetchModFiles: () => Promise<IFileInfo[]>) => ({
  api: { ext: { nexusFetchModFiles } } as unknown as IExtensionApi,
  client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
});

describe("mainFilesQuery", () => {
  it("resolves to the sorted Main files of the mod", async () => {
    const fetchFiles = vi.fn().mockResolvedValue([file(1, 1, 10), file(2, 2, 50), file(3, 1, 20)]);
    const { api, client } = setup(fetchFiles);
    const files = await client.fetchQuery(mainFilesQuery(api, { mod }));
    expect(files.map((f) => f.file_id)).toEqual([3, 1]);
    expect(fetchFiles).toHaveBeenCalledWith("skyrimspecialedition", 42);
  });

  it("rejects when the fetch rejects, and retries on the next call", async () => {
    const fetchFiles = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([file(1, 1, 10)]);
    const { api, client } = setup(fetchFiles);
    await expect(client.fetchQuery(mainFilesQuery(api, { mod }))).rejects.toThrow("offline");
    const files = await client.fetchQuery(mainFilesQuery(api, { mod }));
    expect(files).toHaveLength(1);
    expect(fetchFiles).toHaveBeenCalledTimes(2);
  });

  it("rejects clearly when Nexus integration isn't available", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const api = { ext: {} } as unknown as IExtensionApi;
    await expect(client.fetchQuery(mainFilesQuery(api, { mod }))).rejects.toThrow(
      "Nexus Mods integration isn't available",
    );
  });
});
