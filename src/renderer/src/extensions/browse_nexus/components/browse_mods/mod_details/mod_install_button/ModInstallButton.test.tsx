import type { IFileInfo } from "@nexusmods/nexus-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VortexError } from "@vortex/shared/errors";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ModInstallState } from "@/extensions/browse_nexus/util/mod_install_state/modInstallState";
import { oneClickFileInstallKey } from "@/extensions/browse_nexus/util/one_click_install/oneClickInstall";
import type { IMod } from "@/extensions/mod_management/types/IMod";
import type { ModMainFileVersion } from "@/extensions/nexus_integration/queries/mod/mod.query";
import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import { browseModsTracking } from "@/test-utils/browseModsTracking";
import { settleTransitions } from "@/test-utils/transitions";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { queryClient } from "@/util/queryClient";

const mocks = vi.hoisted(() => {
  const state = {
    isPremium: true,
    installs: true,
    install: vi.fn(),
    download: vi.fn(),
    update: vi.fn(),
    show: vi.fn(),
    fetchFiles: vi.fn(),
    installState: { kind: "none" } as ModInstallState,
  };

  /** The selectors the test answers. */
  const selectors = {
    isPremium: () => state.isPremium,
    activeGameId: () => "skyrimse",
  };

  return Object.assign(state, { selectors });
});

vi.mock("react-redux", () => ({
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({
      settings: { automation: { install: mocks.installs }, interface: {} },
    }),
}));
vi.mock("@/extensions/nexus_integration/selectors", () => ({
  isPremium: mocks.selectors.isPremium,
}));
vi.mock("@/util/selectors", () => ({ activeGameId: mocks.selectors.activeGameId }));
vi.mock("@/extensions/nexus_integration/hooks/useRefreshUserInfoOnFocus", () => ({
  useRefreshUserInfoOnFocus: () => undefined,
}));
vi.mock("@/extensions/mod_management/util/show_mod_on_mods_page/showModOnModsPage", () => ({
  showModOnModsPage: mocks.show,
}));
vi.mock("@/extensions/mod_management/util/update_mod/updateMod", () => ({
  updateMod: mocks.update,
}));
vi.mock("@/extensions/nexus_integration/util/download_and_install/downloadAndInstall", () => ({
  downloadAndInstallNexusFile: mocks.install,
  downloadNexusFile: mocks.download,
}));
vi.mock("@/util/useRelativeTime", () => ({ useRelativeTime: () => "2 days ago" }));
vi.mock("@/extensions/browse_nexus/hooks/use_mod_install_state/useModInstallState.hook", () => ({
  useModInstallState: () => ({ kind: "none" }),
}));

import { ModInstallButton } from "./ModInstallButton";

const mod = {
  id: "7340033",
  game_scoped_id: "1",
  game: { id: "1704", domain_name: "skyrimspecialedition" },
  name: "SkyUI",
} as unknown as ModSummary;

const mainFile: ModMainFileVersion = {
  id: "7340074",
  game_scoped_id: "42",
  is_primary: true,
  supports_mod_managers: true,
};

let tracking: ReturnType<typeof browseModsTracking>;
let showErrorNotification: ReturnType<typeof vi.fn>;
let sendNotification: ReturnType<typeof vi.fn>;
let openUrl: ReturnType<typeof vi.fn>;
let emit: ReturnType<typeof vi.fn>;
let dispatch: ReturnType<typeof vi.fn>;

const renderButton = (file?: ModMainFileVersion | null, isError = false) => {
  const client = new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });
  tracking = browseModsTracking();
  showErrorNotification = vi.fn();
  sendNotification = vi.fn();
  emit = vi.fn();
  dispatch = vi.fn();

  const element = () => (
    <QueryClientProvider client={client}>
      <ModInstallButton
        api={
          {
            showErrorNotification,
            sendNotification,
            events: { emit },
            store: { dispatch },
            ext: { nexusFetchModFiles: mocks.fetchFiles },
          } as unknown as IExtensionApi
        }
        installState={mocks.installState}
        isError={isError}
        mod={mod}
        mainFile={file}
      />
    </QueryClientProvider>
  );
  const view = render(element(), { wrapper: tracking.wrapper });

  return { client, rerender: () => view.rerender(element()) };
};

/** The upsell events sent so far, by name. */
const upsellEvents = () =>
  tracking
    .tracked()
    .filter((e) => e.eventName.startsWith("browse_mods_premium_modal_"))
    .map((e) => [e.eventName, e.properties]);

const button = () => screen.getByRole("button", { name: /^1-click/ });

describe("ModInstallButton", () => {
  beforeEach(() => {
    mocks.isPremium = true;
    mocks.installs = true;
    mocks.install.mockReset();
    mocks.download.mockReset();
    mocks.update.mockReset();
    mocks.show.mockReset();
    mocks.fetchFiles.mockReset();
    mocks.installState = { kind: "none" };
    openUrl = vi.fn();
    window.api.shell = { openUrl } as unknown as typeof window.api.shell;
  });

  it("offers a free user Premium instead, counting it", async () => {
    mocks.isPremium = false;
    renderButton(mainFile);

    await userEvent.click(button());

    expect(
      screen.getByRole("dialog", { name: "Skip the website and install instantly." }),
    ).toBeInTheDocument();
    expect(mocks.install).not.toHaveBeenCalled();
    expect(tracking.tracked("browse_mods_one_click_clicked")).toEqual([]);
    expect(upsellEvents()).toEqual([
      ["browse_mods_premium_modal_shown", { mod_uid: "7340033", action: "install" }],
    ]);
  });

  it("sends a free user to the mod's Files tab to pick a file", async () => {
    mocks.isPremium = false;
    renderButton(mainFile);

    await userEvent.click(button());
    await userEvent.click(screen.getByRole("button", { name: "Install via mod page (free)" }));

    expect(openUrl).toHaveBeenCalledWith(
      "https://www.nexusmods.com/skyrimspecialedition/mods/1?tab=files",
    );
    expect(upsellEvents()).toContainEqual([
      "browse_mods_premium_modal_fallback_clicked",
      { mod_uid: "7340033", action: "install" },
    ]);
  });

  it("installs once a free user unlocks Premium from the upsell", async () => {
    mocks.isPremium = false;
    mocks.install.mockReturnValue(new Promise(() => undefined));
    const { rerender } = renderButton(mainFile);

    await userEvent.click(button());
    mocks.isPremium = true;
    rerender();

    await waitFor(() => expect(mocks.install).toHaveBeenCalledTimes(1));
    expect(tracking.tracked("browse_mods_one_click_clicked").map((e) => e.properties)).toEqual([
      { mod_uid: "7340033", file_uid: "7340074", action: "install" },
    ]);
  });

  it("is off while the mod's details load", () => {
    renderButton(undefined);

    expect(button()).toBeDisabled();
  });

  it("can't install a mod whose details failed to load, and says why", async () => {
    renderButton(undefined, true);

    await userEvent.click(button());
    await userEvent.hover(button());

    expect(button()).toHaveAttribute("aria-disabled", "true");
    expect(mocks.install).not.toHaveBeenCalled();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Couldn't load this mod's files");
  });

  it("can't install a mod v3 has no main file for, says why, and loads none", async () => {
    renderButton(null);

    expect(button()).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(button());
    await userEvent.hover(button());

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "This mod isn't available through Vortex. Download it from Nexus Mods instead.",
    );
    expect(mocks.fetchFiles).not.toHaveBeenCalled();
    expect(mocks.install).not.toHaveBeenCalled();
  });

  it("doesn't upsell a free user a mod v3 has no main file for", async () => {
    mocks.isPremium = false;
    renderButton(null);

    await userEvent.click(button());

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(upsellEvents()).toEqual([]);
  });

  it("shows 1-click's progress while a picker card installs a file of the mod", async () => {
    const { client } = renderButton(mainFile);

    act(() => {
      void client
        .getMutationCache()
        .build(client, {
          mutationKey: oneClickFileInstallKey({ modId: mod.id, fileId: 11 }),
          mutationFn: () => new Promise(() => undefined),
        })
        .execute(undefined);
    });

    await waitFor(() => expect(button()).toBeDisabled());
  });

  it("ignores a picker card's install of another mod's file", async () => {
    const { client } = renderButton(mainFile);

    act(() => {
      void client
        .getMutationCache()
        .build(client, {
          mutationKey: oneClickFileInstallKey({ modId: "7340034", fileId: 11 }),
          mutationFn: () => new Promise(() => undefined),
        })
        .execute(undefined);
    });

    expect(button()).toBeEnabled();
  });

  it("installs the main file, counting it and showing progress until it's done", async () => {
    mocks.install.mockReturnValue(new Promise(() => undefined));
    renderButton(mainFile);

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
    expect(mocks.fetchFiles).not.toHaveBeenCalled();
    expect(tracking.tracked("browse_mods_one_click_clicked").map((e) => e.properties)).toEqual([
      { mod_uid: "7340033", file_uid: "7340074", action: "install" },
    ]);
    await waitFor(() => expect(button()).toBeDisabled());
  });

  it("reports an install that fails", async () => {
    mocks.install.mockRejectedValue(new Error("disk full"));
    renderButton(mainFile);

    await userEvent.click(button());

    await waitFor(() => expect(showErrorNotification).toHaveBeenCalled());
    await waitFor(() => expect(button()).toBeEnabled());
  });

  it("says nothing of an install the user cancelled", async () => {
    mocks.install.mockRejectedValue(
      new VortexError("canceled by user", { kind: "user-canceled", skipped: false }),
    );
    renderButton(mainFile);

    await userEvent.click(button());

    await waitFor(() => expect(button()).toBeEnabled());
    expect(showErrorNotification).not.toHaveBeenCalled();
  });

  it("only downloads, still labelled install, for a user who doesn't install mods once downloaded", async () => {
    mocks.installs = false;
    mocks.download.mockReturnValue(new Promise(() => undefined));
    renderButton(mainFile);

    expect(button()).toHaveTextContent("1-click install");

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

  describe("for a mod the user already has", () => {
    /** SkyUI installed as mod `skyui`, with the update its check found, if any. */
    const installed = (update?: "update" | "update-site") => {
      const skyui = {
        id: "skyui",
        attributes: { source: "nexus", modId: 1, fileId: 7, downloadGame: "skyrimse" },
      } as unknown as IMod;
      mocks.installState = { kind: "installed", mod: skyui, update, installedCount: 1 };
    };

    const clicks = (eventName: string) => tracking.tracked(eventName).map((e) => e.properties);

    it("shows an installed mod on the Mods page, for free users too", async () => {
      mocks.isPremium = false;
      installed();
      renderButton(mainFile);

      await userEvent.click(screen.getByRole("button", { name: "View installed mod" }));

      expect(mocks.show).toHaveBeenCalledWith(expect.anything(), "skyui");
      expect(clicks("browse_mods_view_installed_clicked")).toEqual([{ mod_uid: "7340033" }]);
    });

    it("updates it as the Mods page does when the update check found one", async () => {
      installed("update");
      renderButton(mainFile);

      await userEvent.click(screen.getByRole("button", { name: "Update" }));

      expect(mocks.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ id: "skyui" }),
        "skyrimse",
      );
      expect(clicks("browse_mods_update_clicked")).toEqual([{ mod_uid: "7340033" }]);
    });

    it("opens the mod's page to pick the update when the newest file isn't known", async () => {
      installed("update-site");
      renderButton(mainFile);

      await userEvent.click(screen.getByRole("button", { name: "Update" }));

      expect(emit).toHaveBeenCalledWith("open-mod-page", "skyrimse", 1, "nexus");
      expect(mocks.update).not.toHaveBeenCalled();
    });

    /** Opens the upsell as a free user with an update, then unlocks Premium. */
    const unlockFromUpsell = async () => {
      mocks.isPremium = false;
      const { rerender } = renderButton(mainFile);

      await userEvent.click(button());
      expect(
        screen.getByRole("dialog", { name: "Skip the website and update instantly." }),
      ).toBeInTheDocument();

      mocks.isPremium = true;
      rerender();
    };

    it("offers a free user 1-click update for an update", () => {
      installed("update");
      mocks.isPremium = false;
      renderButton(mainFile);

      expect(button()).toHaveTextContent("1-click update");
    });

    it("upsells a free user 1-click for an update without needing its main file", async () => {
      installed("update");
      mocks.isPremium = false;
      renderButton(null);

      expect(button()).not.toHaveAttribute("aria-disabled", "true");
      await userEvent.click(button());

      expect(
        screen.getByRole("dialog", { name: "Skip the website and update instantly." }),
      ).toBeInTheDocument();
    });

    it("upsells a free user 1-click for an update while its details load", async () => {
      installed("update");
      mocks.isPremium = false;
      renderButton(undefined);

      expect(button()).not.toBeDisabled();
      await userEvent.click(button());

      expect(
        screen.getByRole("dialog", { name: "Skip the website and update instantly." }),
      ).toBeInTheDocument();
    });

    it("upsells a free user an update in words of updating", async () => {
      installed("update");
      mocks.isPremium = false;
      renderButton(mainFile);

      await userEvent.click(button());

      expect(
        screen.getByRole("dialog", { name: "Skip the website and update instantly." }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Update via mod page (free)" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Unlock 1-click updates" })).toBeInTheDocument();
    });

    it("upsells a free user 1-click for an update, counted as one, updating once they unlock", async () => {
      installed("update");

      await unlockFromUpsell();

      expect(upsellEvents()[0]).toEqual([
        "browse_mods_premium_modal_shown",
        { mod_uid: "7340033", action: "update" },
      ]);
      await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
      expect(mocks.install).not.toHaveBeenCalled();
    });

    it("upsells a free user an update to pick too, opening its page once they unlock", async () => {
      installed("update-site");

      await unlockFromUpsell();

      await waitFor(() =>
        expect(emit).toHaveBeenCalledWith("open-mod-page", "skyrimse", 1, "nexus"),
      );
      expect(mocks.install).not.toHaveBeenCalled();
    });

    it("shows an install in progress, wherever it was started", () => {
      mocks.installState = { kind: "installing" };
      renderButton(mainFile);

      expect(screen.getByRole("button", { name: "Install" })).toBeDisabled();
    });

    it("holds 1-click install's progress once its download is done, until it's installed", async () => {
      mocks.install.mockReturnValue(new Promise(() => undefined));
      const { rerender } = renderButton(mainFile);

      await userEvent.click(button());
      mocks.installState = { kind: "downloaded", downloadId: "dl", downloadCount: 1 };
      rerender();

      await waitFor(() => expect(button()).toBeDisabled());
      expect(screen.queryByRole("button", { name: "Install" })).not.toBeInTheDocument();
    });

    it("keeps saying 1-click install while it finishes, once the mod counts as installed", async () => {
      mocks.install.mockReturnValue(new Promise(() => undefined));
      const { rerender } = renderButton(mainFile);

      await userEvent.click(button());
      installed();
      rerender();

      await waitFor(() => expect(button()).toBeDisabled());
      expect(button()).toHaveTextContent("1-click install");
    });

    it("installs a download that isn't installed, for free users too", async () => {
      mocks.isPremium = false;
      mocks.installState = { kind: "downloaded", downloadId: "dl", downloadCount: 1 };
      renderButton(mainFile);

      await userEvent.click(screen.getByRole("button", { name: "Install" }));

      expect(emit).toHaveBeenCalledWith("start-install-download", "dl");
      expect(clicks("browse_mods_install_clicked")).toEqual([{ mod_uid: "7340033" }]);
    });
  });

  describe("for a mod without a primary file", () => {
    /** The newest Main file, which v3 gives a mod with several and no primary. */
    const newestFile: ModMainFileVersion = { ...mainFile, is_primary: false };

    /** A Main file of the mod, newer as its id grows. */
    const mainFiles = (...ids: number[]) =>
      ids.map(
        (file_id) =>
          ({
            file_id,
            category_id: 1,
            name: `File ${file_id}`,
            version: "1.0",
            description: "",
            size_kb: 1,
            uploaded_timestamp: file_id,
            is_primary: false,
          }) as IFileInfo,
      );

    const pickerClose = () => screen.queryByTestId("main-file-picker-close");

    it("opens the picker on its Main files, counting it", async () => {
      mocks.fetchFiles.mockResolvedValue(mainFiles(11, 12, 13));
      renderButton(newestFile);

      await userEvent.click(button());

      expect(await screen.findByTestId("main-file-picker-close")).toBeInTheDocument();
      expect(mocks.fetchFiles).toHaveBeenCalledWith("skyrimspecialedition", 1);
      expect(tracking.tracked("browse_mods_file_picker_opened").map((e) => e.properties)).toEqual([
        { mod_uid: "7340033", file_count: 3, source: "one_click" },
      ]);
      expect(mocks.install).not.toHaveBeenCalled();
    });

    it("installs its one Main file without asking", async () => {
      mocks.fetchFiles.mockResolvedValue(mainFiles(11));
      mocks.install.mockReturnValue(new Promise(() => undefined));
      renderButton(newestFile);

      await userEvent.click(button());

      await waitFor(() =>
        expect(mocks.install).toHaveBeenCalledWith(expect.anything(), {
          gameDomain: "skyrimspecialedition",
          gameId: "skyrimse",
          modId: "1",
          fileId: "11",
          name: "SkyUI",
        }),
      );
      expect(tracking.tracked("browse_mods_one_click_clicked").map((e) => e.properties)).toEqual([
        { mod_uid: "7340033", file_uid: "7318624272395", action: "install" },
      ]);
      expect(pickerClose()).not.toBeInTheDocument();
      await waitFor(() => expect(button()).toBeDisabled());
    });

    it("says it couldn't load the files, and tries again on the next click", async () => {
      mocks.fetchFiles.mockRejectedValue(new Error("offline"));
      renderButton(newestFile);

      await userEvent.click(button());
      await waitFor(() => expect(button()).toBeEnabled());
      await userEvent.hover(button());

      expect(await screen.findByRole("tooltip")).toHaveTextContent(
        "Couldn't load this mod's files",
      );
      expect(button()).not.toHaveAttribute("aria-disabled", "true");

      await userEvent.click(button());

      await waitFor(() => expect(mocks.fetchFiles).toHaveBeenCalledTimes(2));
    });

    it("can't install a mod with no Main files, and says why", async () => {
      mocks.fetchFiles.mockResolvedValue([]);
      renderButton(newestFile);

      await userEvent.click(button());
      await waitFor(() => expect(button()).toHaveAttribute("aria-disabled", "true"));
      await userEvent.hover(button());

      expect(await screen.findByRole("tooltip")).toHaveTextContent(
        "This mod isn't available through Vortex. Download it from Nexus Mods instead.",
      );
      expect(mocks.install).not.toHaveBeenCalled();
    });

    it("upsells a free user first, opening the picker once they unlock Premium", async () => {
      mocks.isPremium = false;
      mocks.fetchFiles.mockResolvedValue(mainFiles(11, 12));
      const { rerender } = renderButton(newestFile);

      await userEvent.click(button());

      expect(mocks.fetchFiles).not.toHaveBeenCalled();
      expect(upsellEvents()).toEqual([
        ["browse_mods_premium_modal_shown", { mod_uid: "7340033", action: "install" }],
      ]);

      mocks.isPremium = true;
      rerender();

      expect(await screen.findByTestId("main-file-picker-close")).toBeInTheDocument();
      expect(mocks.install).not.toHaveBeenCalled();
    });

    it("returns focus to the button when the picker closes", async () => {
      mocks.fetchFiles.mockResolvedValue(mainFiles(11, 12, 13));
      renderButton(newestFile);

      await userEvent.click(button());
      await userEvent.click(await screen.findByTestId("main-file-picker-close"));

      await waitFor(() => expect(pickerClose()).not.toBeInTheDocument());
      await waitFor(() => expect(button()).toHaveFocus());
    });

    describe("once the user has it", () => {
      /** Opens the split button's menu and picks View all main files. */
      const viewAllFiles = async () => {
        await userEvent.click(screen.getByTestId("mod-install-options"));
        await userEvent.click(await screen.findByTestId("mod-install-view-all-files"));
      };

      beforeEach(() => {
        mocks.installState = {
          kind: "installed",
          mod: { id: "skyui", attributes: {} } as unknown as IMod,
          installedCount: 1,
        };
      });

      it("keeps showing the installed mod from the split button's main part", async () => {
        renderButton(newestFile);

        await userEvent.click(screen.getByTestId("mod-install-main"));

        expect(mocks.show).toHaveBeenCalledWith(expect.anything(), "skyui");
        expect(mocks.fetchFiles).not.toHaveBeenCalled();
      });

      it("shows a free user's installed mod however many of its files are installed", async () => {
        mocks.isPremium = false;
        mocks.installState = {
          kind: "installed",
          mod: { id: "skyui", attributes: {} } as unknown as IMod,
          installedCount: 2,
        };
        renderButton(newestFile);

        await userEvent.click(screen.getByTestId("mod-install-main"));

        expect(mocks.show).toHaveBeenCalledWith(expect.anything(), "skyui");
        expect(mocks.fetchFiles).not.toHaveBeenCalled();
      });

      it("opens the picker from View installed mod when several of its files are installed", async () => {
        mocks.installState = {
          kind: "installed",
          mod: { id: "skyui", attributes: {} } as unknown as IMod,
          installedCount: 2,
        };
        mocks.fetchFiles.mockResolvedValue(mainFiles(11, 12));
        renderButton(newestFile);

        await userEvent.click(screen.getByTestId("mod-install-main"));

        expect(await screen.findByTestId("main-file-picker-close")).toBeInTheDocument();
        expect(mocks.show).not.toHaveBeenCalled();
        expect(tracking.tracked("browse_mods_view_installed_clicked")).toEqual([]);
        expect(tracking.tracked("browse_mods_file_picker_opened").map((e) => e.properties)).toEqual(
          [{ mod_uid: "7340033", file_count: 2, source: "split_button" }],
        );
        await settleTransitions();
      });

      it("installs a download that isn't installed from the split button's main part", async () => {
        mocks.installState = { kind: "downloaded", downloadId: "dl", downloadCount: 1 };
        renderButton(newestFile);

        await userEvent.click(screen.getByTestId("mod-install-main"));

        expect(emit).toHaveBeenCalledWith("start-install-download", "dl");
        expect(mocks.fetchFiles).not.toHaveBeenCalled();
      });

      it("installs a free user's first download however many there are", async () => {
        mocks.isPremium = false;
        mocks.installState = { kind: "downloaded", downloadId: "dl", downloadCount: 2 };
        renderButton(newestFile);

        await userEvent.click(screen.getByTestId("mod-install-main"));

        expect(emit).toHaveBeenCalledWith("start-install-download", "dl");
        expect(mocks.fetchFiles).not.toHaveBeenCalled();
      });

      it("opens the picker from Install when several of its files are downloaded", async () => {
        mocks.installState = { kind: "downloaded", downloadId: "dl", downloadCount: 2 };
        mocks.fetchFiles.mockResolvedValue(mainFiles(11, 12));
        renderButton(newestFile);

        await userEvent.click(screen.getByTestId("mod-install-main"));

        expect(await screen.findByTestId("main-file-picker-close")).toBeInTheDocument();
        expect(emit).not.toHaveBeenCalledWith("start-install-download", expect.anything());
        expect(tracking.tracked("browse_mods_install_clicked")).toEqual([]);
        expect(tracking.tracked("browse_mods_file_picker_opened").map((e) => e.properties)).toEqual(
          [{ mod_uid: "7340033", file_count: 2, source: "split_button" }],
        );
        await settleTransitions();
      });

      it("opens the picker from View all main files, counting it", async () => {
        mocks.fetchFiles.mockResolvedValue(mainFiles(11, 12));
        renderButton(newestFile);

        await viewAllFiles();

        expect(await screen.findByTestId("main-file-picker-close")).toBeInTheDocument();
        expect(tracking.tracked("browse_mods_file_picker_opened").map((e) => e.properties)).toEqual(
          [{ mod_uid: "7340033", file_count: 2, source: "split_menu" }],
        );
        expect(
          within(screen.getByRole("dialog")).getAllByTestId(/^main-file-card-\d+$/),
        ).toHaveLength(2);
        await settleTransitions();
      });

      it("opens the picker on its one Main file from View all main files", async () => {
        mocks.fetchFiles.mockResolvedValue(mainFiles(11));
        renderButton(newestFile);

        await viewAllFiles();

        expect(await screen.findByTestId("main-file-picker-close")).toBeInTheDocument();
        expect(tracking.tracked("browse_mods_file_picker_opened").map((e) => e.properties)).toEqual(
          [{ mod_uid: "7340033", file_count: 1, source: "split_menu" }],
        );
        expect(mocks.install).not.toHaveBeenCalled();
        await settleTransitions();
      });

      it("spins the split button while View all main files loads them", async () => {
        mocks.fetchFiles.mockReturnValue(new Promise(() => undefined));
        renderButton(newestFile);

        await viewAllFiles();

        await waitFor(() => expect(screen.getByTestId("mod-install-main")).toBeDisabled());
        expect(screen.getByTestId("mod-install-options")).toBeDisabled();
      });

      it("says in a notification when View all main files can't load them", async () => {
        const error = new Error("offline");
        mocks.fetchFiles.mockRejectedValue(error);
        renderButton(newestFile);

        await viewAllFiles();

        await waitFor(() =>
          expect(showErrorNotification).toHaveBeenCalledWith(
            "Couldn't load this mod's files",
            error,
            { allowReport: false },
          ),
        );
        expect(pickerClose()).not.toBeInTheDocument();
        await waitFor(() => expect(screen.getByTestId("mod-install-main")).toBeEnabled());
      });

      it("says in a notification when View all main files finds none", async () => {
        mocks.fetchFiles.mockResolvedValue([]);
        renderButton(newestFile);

        await viewAllFiles();

        await waitFor(() =>
          expect(sendNotification).toHaveBeenCalledWith({
            type: "info",
            message:
              "This mod isn't available through Vortex. Download it from Nexus Mods instead.",
          }),
        );
        expect(pickerClose()).not.toBeInTheDocument();
      });

      it("upsells a free user View all main files, opening the picker once they unlock", async () => {
        mocks.isPremium = false;
        mocks.fetchFiles.mockResolvedValue(mainFiles(11, 12));
        const { rerender } = renderButton(newestFile);

        await viewAllFiles();

        expect(mocks.fetchFiles).not.toHaveBeenCalled();
        expect(pickerClose()).not.toBeInTheDocument();
        expect(
          screen.getByRole("dialog", { name: "Choose a file to install with Premium." }),
        ).toBeInTheDocument();
        expect(upsellEvents()).toEqual([
          ["browse_mods_premium_modal_shown", { mod_uid: "7340033", action: "view_files" }],
        ]);

        mocks.isPremium = true;
        rerender();

        expect(await screen.findByTestId("main-file-picker-close")).toBeInTheDocument();
        expect(tracking.tracked("browse_mods_file_picker_opened").map((e) => e.properties)).toEqual(
          [{ mod_uid: "7340033", file_count: 2, source: "split_menu" }],
        );
        expect(mocks.update).not.toHaveBeenCalled();
        await settleTransitions();
      });

      it("returns focus to the main part when the picker closes", async () => {
        mocks.fetchFiles.mockResolvedValue(mainFiles(11, 12));
        renderButton(newestFile);

        await viewAllFiles();
        await userEvent.click(await screen.findByTestId("main-file-picker-close"));

        await waitFor(() => expect(pickerClose()).not.toBeInTheDocument());
        await waitFor(() => expect(screen.getByTestId("mod-install-main")).toHaveFocus());
      });

      it("keeps a mod with a primary file to its one button", () => {
        renderButton(mainFile);

        expect(screen.queryByTestId("mod-install-options")).not.toBeInTheDocument();
      });
    });
  });
});
