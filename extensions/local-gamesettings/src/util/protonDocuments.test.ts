import * as path from "path";

import { describe, expect, it, vi } from "vitest";

import { resolveDocumentsPath } from "./protonDocuments";

describe("resolveDocumentsPath", () => {
  const hostDocuments = "/home/test/Documents";
  const discovery = { store: "steam", path: "/games/Oblivion" };

  it("uses the Proton prefix for a Linux Steam game running under Proton", async () => {
    const findByPath = vi.fn().mockResolvedValue({
      usesProton: true,
      compatDataPath: "/steam/steamapps/compatdata/22330",
    });

    await expect(resolveDocumentsPath(discovery, hostDocuments, findByPath, "linux")).resolves.toBe(
      path.join(
        "/steam/steamapps/compatdata/22330",
        "pfx",
        "drive_c",
        "users",
        "steamuser",
        "Documents",
      ),
    );
    expect(findByPath).toHaveBeenCalledWith("/games/Oblivion", "steam");
  });

  it("falls back to host Documents outside Linux", async () => {
    const findByPath = vi.fn();

    await expect(resolveDocumentsPath(discovery, hostDocuments, findByPath, "win32")).resolves.toBe(
      hostDocuments,
    );
    expect(findByPath).not.toHaveBeenCalled();
  });

  it("falls back when the discovered game is not a Steam install", async () => {
    const findByPath = vi.fn();

    await expect(
      resolveDocumentsPath(
        { store: "gog", path: "/games/Oblivion" },
        hostDocuments,
        findByPath,
        "linux",
      ),
    ).resolves.toBe(hostDocuments);
    expect(findByPath).not.toHaveBeenCalled();
  });

  it("falls back when the matching Steam entry does not use Proton", async () => {
    const findByPath = vi.fn().mockResolvedValue({ usesProton: false });

    await expect(resolveDocumentsPath(discovery, hostDocuments, findByPath, "linux")).resolves.toBe(
      hostDocuments,
    );
  });

  it("falls back when the store entry cannot be resolved", async () => {
    const findByPath = vi.fn().mockRejectedValue(new Error("not found"));

    await expect(
      resolveDocumentsPath(discovery, hostDocuments, findByPath, "linux"),
    ).resolves.toBe(hostDocuments);
  });
});
