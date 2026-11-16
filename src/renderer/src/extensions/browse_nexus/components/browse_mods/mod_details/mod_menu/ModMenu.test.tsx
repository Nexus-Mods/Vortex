import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import { browseModsTracking } from "@/test-utils/browseModsTracking";
import type { IExtensionApi } from "@/types/IExtensionContext";

import { ModMenu } from "./ModMenu";

const mod = {
  id: "1704-12604",
  game_scoped_id: "12604",
  game: { domain_name: "skyrimspecialedition" },
} as unknown as ModSummary;

/** Renders the menu with the clipboard writing as `writeText` does, and opens it. */
const renderOpenMenu = async (writeText = vi.fn().mockResolvedValue(undefined)) => {
  const openUrl = vi.fn();
  vi.stubGlobal("api", { ...window.api, clipboard: { writeText }, shell: { openUrl } });
  const api = {
    sendNotification: vi.fn(),
    showErrorNotification: vi.fn(),
  } as unknown as IExtensionApi;
  const tracking = browseModsTracking();
  render(
    <ModMenu
      api={api}
      mod={mod}
      modPageUrl="https://www.nexusmods.com/skyrimspecialedition/mods/12604"
    />,
    { wrapper: tracking.wrapper },
  );

  await userEvent.click(screen.getByTestId("mod-menu"));

  return {
    api,
    writeText,
    openUrl,
    propertiesOf: (eventName: string) =>
      tracking.tracked(eventName).map(({ properties }) => properties),
  };
};

describe("ModMenu", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("copies a link to the mod's page, saying so, and counts it", async () => {
    const { api, writeText, propertiesOf } = await renderOpenMenu();

    await userEvent.click(screen.getByTestId("mod-menu-copy-link"));

    expect(writeText).toHaveBeenCalledWith(
      "https://www.nexusmods.com/skyrimspecialedition/mods/12604",
    );
    await waitFor(() =>
      expect(api.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ id: "browse-mods-mod-link-copied", type: "success" }),
      ),
    );
    expect(propertiesOf("browse_mods_mod_link_copied")).toEqual([{ mod_uid: "1704-12604" }]);
  });

  it("says when the link couldn't be copied, without offering to report it or counting it", async () => {
    const { api, propertiesOf } = await renderOpenMenu(
      vi.fn().mockRejectedValue(new Error("Clipboard busy")),
    );

    await userEvent.click(screen.getByTestId("mod-menu-copy-link"));

    await waitFor(() =>
      expect(api.showErrorNotification).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Error),
        { allowReport: false },
      ),
    );
    expect(api.sendNotification).not.toHaveBeenCalled();
    expect(propertiesOf("browse_mods_mod_link_copied")).toEqual([]);
  });

  it("opens the mod's page to report it, and counts it", async () => {
    const { openUrl, propertiesOf } = await renderOpenMenu();

    await userEvent.click(screen.getByTestId("mod-menu-report"));

    expect(openUrl).toHaveBeenCalledWith(
      "https://www.nexusmods.com/skyrimspecialedition/mods/12604?report=1",
    );
    expect(propertiesOf("browse_mods_mod_report_opened")).toEqual([{ mod_uid: "1704-12604" }]);
  });

  it("closes the menu once the link's copied", async () => {
    await renderOpenMenu();

    await userEvent.click(screen.getByTestId("mod-menu-copy-link"));

    await waitFor(() => expect(screen.queryByTestId("mod-menu-copy-link")).toBeNull());
  });

  it("closes the menu once Report mod is picked", async () => {
    await renderOpenMenu();

    await userEvent.click(screen.getByTestId("mod-menu-report"));

    expect(screen.queryByTestId("mod-menu-report")).toBeNull();
  });
});
