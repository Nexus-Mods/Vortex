import type { IFileInfo } from "@nexusmods/nexus-api";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NexusGameDomain } from "@vortex/shared";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IDownload } from "@/extensions/download_management/types/IDownload";
import type { IMod } from "@/extensions/mod_management/types/IMod";
import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import type { IExtensionApi } from "@/types/IExtensionContext";

const mocks = vi.hoisted(() => ({
  mods: {} as Record<string, IMod>,
  downloads: {} as Record<string, IDownload>,
  show: vi.fn(),
  showDownload: vi.fn(),
}));

vi.mock("react-redux", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({
      persistent: { mods: { skyrimse: mocks.mods }, downloads: { files: mocks.downloads } },
    }),
}));
vi.mock("@/util/selectors", () => ({ activeGameId: () => "skyrimse" }));
vi.mock("@/extensions/browse_nexus/hooks/use_mod_install_state/modInstallSelectors", () => ({
  gameDomains: () => () => NexusGameDomain("skyrimspecialedition"),
  modInstallGroups: () =>
    new Map([
      [
        "skyrimspecialedition/1",
        { mods: Object.keys(mocks.mods), downloads: Object.keys(mocks.downloads) },
      ],
    ]),
}));
vi.mock("@/extensions/mod_management/util/show_mod_on_mods_page/showModOnModsPage", () => ({
  showModOnModsPage: mocks.show,
  showDownloadOnModsPage: mocks.showDownload,
}));

import { OtherFiles } from "./OtherFiles";

const mod = {
  id: "7340033",
  game_scoped_id: "1",
  game: { id: "1704", domain_name: "skyrimspecialedition" },
  name: "SkyUI",
} as unknown as ModSummary;

const api = {} as IExtensionApi;

const site = (file_id: number, category_name: string) =>
  ({ file_id, category_name, name: `File ${file_id}` }) as IFileInfo;

const installed = (id: string, fileId: number) =>
  ({
    id,
    type: "",
    state: "installed",
    installationPath: id,
    attributes: { source: "nexus", modId: 1, fileId, downloadGame: "skyrimse" },
  }) as IMod;

const downloaded = (fileId: number) =>
  ({
    state: "finished",
    game: ["skyrimse"],
    modInfo: { nexus: { ids: { gameId: "skyrimspecialedition", modId: 1, fileId } } },
  }) as IDownload;

const FILES = [site(1, "MAIN"), site(2, "OPTIONAL"), site(3, "OPTIONAL"), site(4, "ARCHIVED")];

const renderFiles = () => {
  const onLeave = vi.fn();
  render(<OtherFiles api={api} files={FILES} mod={mod} onLeave={onLeave} />);
  return { onLeave };
};

describe("OtherFiles", () => {
  beforeEach(() => {
    mocks.mods = {};
    mocks.downloads = {};
    mocks.show.mockReset();
    mocks.showDownload.mockReset();
  });

  it("shows nothing when the user has only Main files", () => {
    mocks.mods = { main: installed("main", 1) };
    renderFiles();

    expect(screen.queryByTestId("other-files")).toBeNull();
  });

  it("lists the user's other files under a heading per category", () => {
    mocks.mods = { patch: installed("patch", 2) };
    mocks.downloads = { eyes: downloaded(3), old: downloaded(4) };
    renderFiles();

    const optional = screen.getByTestId("other-files-OPTIONAL");

    expect(within(optional).getByTestId("other-file-patch")).toBeInTheDocument();
    expect(within(optional).getByTestId("other-file-eyes")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("other-files-ARCHIVED")).getByTestId("other-file-old"),
    ).toBeInTheDocument();
  });

  it("closes the picker and shows an installed file's mod on the Mods page", async () => {
    mocks.mods = { patch: installed("patch", 2) };
    const { onLeave } = renderFiles();

    await userEvent.click(screen.getByTestId("other-file-patch"));

    expect(onLeave).toHaveBeenCalled();
    expect(mocks.show).toHaveBeenCalledWith(api, "patch");
  });

  it("shows a file that's only downloaded by its download", async () => {
    mocks.downloads = { eyes: downloaded(3) };
    renderFiles();

    await userEvent.click(screen.getByTestId("other-file-eyes"));

    expect(mocks.showDownload).toHaveBeenCalledWith(api, "eyes");
    expect(mocks.show).not.toHaveBeenCalled();
  });
});
