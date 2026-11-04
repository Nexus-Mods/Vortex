import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VortexError } from "@vortex/shared/errors";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IMod } from "@/extensions/mod_management/types/IMod";
import type { MinimalModFileVersion } from "@/extensions/nexus_integration/queries/mod/mod.query";
import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import { browseModsTracking } from "@/test-utils/browseModsTracking";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { queryClient } from "@/util/queryClient";

import type {
  INexusModRef,
  ModInstallState,
} from "../../../../hooks/use_mod_install_state/useModInstallState.hook";

const mocks = vi.hoisted(() => {
  const state = {
    isPremium: true,
    installs: true,
    install: vi.fn(),
    download: vi.fn(),
    update: vi.fn(),
    show: vi.fn(),
    installState: { kind: "none" } as ModInstallState,
    lookedUp: [] as INexusModRef[],
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
      settings: { automation: { install: mocks.installs } },
    }),
}));
vi.mock("@/extensions/nexus_integration/selectors", () => ({
  isPremium: mocks.selectors.isPremium,
}));
vi.mock("@/util/selectors", () => ({ activeGameId: mocks.selectors.activeGameId }));
vi.mock("@/extensions/nexus_integration/hooks/useRefreshUserInfoOnFocus", () => ({
  useRefreshUserInfoOnFocus: () => undefined,
}));
vi.mock("../../../../hooks/use_mod_install_state/useModInstallState.hook", () => ({
  useModInstallState: (ref: INexusModRef) => {
    mocks.lookedUp.push(ref);
    return mocks.installState;
  },
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
let openUrl: ReturnType<typeof vi.fn>;
let emit: ReturnType<typeof vi.fn>;
let dispatch: ReturnType<typeof vi.fn>;

const renderButton = (file?: MinimalModFileVersion | null, isError = false) => {
  const client = new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });
  tracking = browseModsTracking();
  showErrorNotification = vi.fn();
  emit = vi.fn();
  dispatch = vi.fn();

  const element = () => (
    <QueryClientProvider client={client}>
      <ModInstallButton
        api={
          {
            showErrorNotification,
            events: { emit },
            store: { dispatch },
          } as unknown as IExtensionApi
        }
        isError={isError}
        mod={mod}
        primaryFile={file}
      />
    </QueryClientProvider>
  );
  const view = render(element(), { wrapper: tracking.wrapper });

  return { rerender: () => view.rerender(element()) };
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
    mocks.installState = { kind: "none" };
    mocks.lookedUp = [];
    openUrl = vi.fn();
    window.api.shell = { openUrl } as unknown as typeof window.api.shell;
  });

  it("offers a free user Premium instead, counting it", async () => {
    mocks.isPremium = false;
    renderButton(primaryFile);

    await userEvent.click(button());

    expect(screen.getByText("Skip the website and install instantly.")).toBeInTheDocument();
    expect(mocks.install).not.toHaveBeenCalled();
    expect(tracking.tracked("browse_mods_one_click_clicked")).toEqual([]);
    expect(upsellEvents()).toEqual([
      ["browse_mods_premium_modal_shown", { mod_uid: "7340033", action: "install" }],
    ]);
  });

  it("sends a free user to the mod's Files tab to pick a file", async () => {
    mocks.isPremium = false;
    renderButton(primaryFile);

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
    const { rerender } = renderButton(primaryFile);

    await userEvent.click(button());
    mocks.isPremium = true;
    rerender();

    await waitFor(() => expect(mocks.install).toHaveBeenCalledTimes(1));
    expect(tracking.tracked("browse_mods_one_click_clicked").map((e) => e.properties)).toEqual([
      { mod_uid: "7340033", file_uid: "7340074", action: "install" },
    ]);
  });

  it("doesn't upsell a mod it couldn't install anyway", async () => {
    mocks.isPremium = false;
    renderButton(null);

    await userEvent.click(button());

    expect(screen.queryByText("Skip the website and install instantly.")).not.toBeInTheDocument();
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
    expect(
      await screen.findByText(
        "This mod isn't available through Vortex. Download it from Nexus Mods instead.",
      ),
    ).toBeInTheDocument();
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
    mocks.install.mockRejectedValue(
      new VortexError("canceled by user", { kind: "user-canceled", skipped: false }),
    );
    renderButton(primaryFile);

    await userEvent.click(button());

    await waitFor(() => expect(button()).toBeEnabled());
    expect(showErrorNotification).not.toHaveBeenCalled();
  });

  it("only downloads, still labelled install, for a user who doesn't install mods once downloaded", async () => {
    mocks.installs = false;
    mocks.download.mockReturnValue(new Promise(() => undefined));
    renderButton(primaryFile);

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

  it("looks the mod up by its game's domain and its id", () => {
    renderButton(primaryFile);

    expect(mocks.lookedUp[0]).toEqual({ domain: "skyrimspecialedition", modId: 1 });
  });

  describe("for a mod the user already has", () => {
    /** SkyUI installed as mod `skyui`, with the update its check found, if any. */
    const installed = (update?: "update" | "update-site") => {
      const skyui = {
        id: "skyui",
        attributes: { source: "nexus", modId: 1, fileId: 7, downloadGame: "skyrimse" },
      } as unknown as IMod;
      mocks.installState = { kind: "installed", mod: skyui, update };
    };

    const clicks = (eventName: string) => tracking.tracked(eventName).map((e) => e.properties);

    it("shows an installed mod on the Mods page, for free users too", async () => {
      mocks.isPremium = false;
      installed();
      renderButton(primaryFile);

      await userEvent.click(screen.getByRole("button", { name: "View installed mod" }));

      expect(mocks.show).toHaveBeenCalledWith(expect.anything(), "skyui");
      expect(clicks("browse_mods_view_installed_clicked")).toEqual([{ mod_uid: "7340033" }]);
    });

    it("updates it as the Mods page does when the update check found one", async () => {
      installed("update");
      renderButton(primaryFile);

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
      renderButton(primaryFile);

      await userEvent.click(screen.getByRole("button", { name: "Update" }));

      expect(emit).toHaveBeenCalledWith("open-mod-page", "skyrimse", 1, "nexus");
      expect(mocks.update).not.toHaveBeenCalled();
    });

    /** Opens the upsell as a free user with an update, then unlocks Premium. */
    const unlockFromUpsell = async () => {
      mocks.isPremium = false;
      const { rerender } = renderButton(primaryFile);

      await userEvent.click(button());
      expect(screen.getByText("Skip the website and install instantly.")).toBeInTheDocument();

      mocks.isPremium = true;
      rerender();
    };

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
      renderButton(primaryFile);

      expect(screen.getByRole("button", { name: "Install" })).toBeDisabled();
    });

    it("holds 1-click install's progress once its download is done, until it's installed", async () => {
      mocks.install.mockReturnValue(new Promise(() => undefined));
      const { rerender } = renderButton(primaryFile);

      await userEvent.click(button());
      mocks.installState = { kind: "downloaded", downloadId: "dl" };
      rerender();

      await waitFor(() => expect(button()).toBeDisabled());
      expect(screen.queryByRole("button", { name: "Install" })).not.toBeInTheDocument();
    });

    it("installs a download that isn't installed, for free users too", async () => {
      mocks.isPremium = false;
      mocks.installState = { kind: "downloaded", downloadId: "dl" };
      renderButton(primaryFile);

      await userEvent.click(screen.getByRole("button", { name: "Install" }));

      expect(emit).toHaveBeenCalledWith("start-install-download", "dl");
      expect(clicks("browse_mods_install_clicked")).toEqual([{ mod_uid: "7340033" }]);
    });
  });
});
