import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MinimalModFileVersion } from "@/extensions/nexus_integration/queries/mod/mod.query";
import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import { browseModsTracking } from "@/test-utils/browseModsTracking";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { UserCanceled } from "@/util/CustomErrors";
import { queryClient } from "@/util/queryClient";

const mocks = vi.hoisted(() => {
  const state = { isPremium: true, installs: true, install: vi.fn(), download: vi.fn() };

  /** The selectors the test answers. */
  const selectors = {
    isPremium: () => state.isPremium,
    activeGameId: () => "skyrimse",
  };

  return Object.assign(state, { selectors });
});

vi.mock("react-redux", () => ({
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({ settings: { automation: { install: mocks.installs } } }),
}));
vi.mock("@/extensions/nexus_integration/selectors", () => ({
  isPremium: mocks.selectors.isPremium,
}));
vi.mock("@/util/selectors", () => ({ activeGameId: mocks.selectors.activeGameId }));
vi.mock("@/extensions/nexus_integration/util/download_and_install/downloadAndInstall", () => ({
  downloadAndInstallNexusFile: mocks.install,
  downloadNexusFile: mocks.download,
}));

import { ModInstallButton } from "./ModInstallButton";

const mod = {
  id: "7340033",
  game_scoped_id: "1",
  game: { domain_name: "skyrimspecialedition" },
  name: "SkyUI",
} as unknown as ModSummary;

const primaryFile: MinimalModFileVersion = { id: "7340074", game_scoped_id: "42" };

let tracking: ReturnType<typeof browseModsTracking>;
let showErrorNotification: ReturnType<typeof vi.fn>;

const renderButton = (file?: MinimalModFileVersion | null, isError = false) => {
  const client = new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });
  tracking = browseModsTracking();
  showErrorNotification = vi.fn();

  render(
    <QueryClientProvider client={client}>
      <ModInstallButton
        api={{ showErrorNotification } as unknown as IExtensionApi}
        isError={isError}
        mod={mod}
        primaryFile={file}
      />
    </QueryClientProvider>,
    { wrapper: tracking.wrapper },
  );
};

const button = () => screen.getByRole("button", { name: /^1-click/ });

describe("ModInstallButton", () => {
  beforeEach(() => {
    mocks.isPremium = true;
    mocks.installs = true;
    mocks.install.mockReset();
    mocks.download.mockReset();
  });

  it("is offered to Premium users only", () => {
    mocks.isPremium = false;
    renderButton(primaryFile);

    expect(screen.queryByRole("button", { name: "1-click install" })).not.toBeInTheDocument();
  });

  it("is off while the mod's details load", () => {
    renderButton(undefined);

    expect(button()).toBeDisabled();
  });

  it("can't install a mod without a primary file, and says why", async () => {
    renderButton(null);

    await userEvent.click(button());
    await userEvent.hover(button());

    expect(button()).toHaveAttribute("aria-disabled", "true");
    expect(mocks.install).not.toHaveBeenCalled();
    expect(await screen.findByText("This mod has no file to download")).toBeInTheDocument();
  });

  it("can't install a mod whose details failed to load, and says why", async () => {
    renderButton(undefined, true);

    await userEvent.click(button());
    await userEvent.hover(button());

    expect(button()).toHaveAttribute("aria-disabled", "true");
    expect(mocks.install).not.toHaveBeenCalled();
    expect(await screen.findByText("Couldn't load this mod's files")).toBeInTheDocument();
  });

  it("installs the primary file, counting it and showing progress until it's done", async () => {
    mocks.install.mockReturnValue(new Promise(() => undefined));
    renderButton(primaryFile);

    await userEvent.click(button());

    expect(mocks.install).toHaveBeenCalledWith(expect.anything(), {
      gameDomain: "skyrimspecialedition",
      gameId: "skyrimse",
      modId: "1",
      fileId: "42",
      name: "SkyUI",
    });
    expect(button()).toHaveTextContent("1-click install");
    expect(mocks.download).not.toHaveBeenCalled();
    expect(tracking.tracked("browse_mods_one_click_clicked").map((e) => e.properties)).toEqual([
      { mod_uid: "7340033", file_uid: "7340074", action: "install" },
    ]);
    await waitFor(() => expect(button()).toBeDisabled());
  });

  it("reports an install that fails", async () => {
    mocks.install.mockRejectedValue(new Error("disk full"));
    renderButton(primaryFile);

    await userEvent.click(button());

    await waitFor(() => expect(showErrorNotification).toHaveBeenCalled());
    await waitFor(() => expect(button()).toBeEnabled());
  });

  it("says nothing of an install the user cancelled", async () => {
    mocks.install.mockRejectedValue(new UserCanceled());
    renderButton(primaryFile);

    await userEvent.click(button());

    await waitFor(() => expect(button()).toBeEnabled());
    expect(showErrorNotification).not.toHaveBeenCalled();
  });

  it("only downloads, and says so, for a user who doesn't install mods once downloaded", async () => {
    mocks.installs = false;
    mocks.download.mockReturnValue(new Promise(() => undefined));
    renderButton(primaryFile);

    expect(button()).toHaveTextContent("1-click download");

    await userEvent.click(button());

    expect(mocks.download).toHaveBeenCalledWith(expect.anything(), {
      gameDomain: "skyrimspecialedition",
      gameId: "skyrimse",
      modId: "1",
      fileId: "42",
      name: "SkyUI",
    });
    expect(mocks.install).not.toHaveBeenCalled();
    expect(tracking.tracked("browse_mods_one_click_clicked").map((e) => e.properties)).toEqual([
      { mod_uid: "7340033", file_uid: "7340074", action: "download" },
    ]);
  });
});
