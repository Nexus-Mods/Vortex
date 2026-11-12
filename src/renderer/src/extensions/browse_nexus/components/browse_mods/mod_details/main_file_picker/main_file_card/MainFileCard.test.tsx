import type { IFileInfo } from "@nexusmods/nexus-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ModInstallState } from "@/extensions/browse_nexus/util/mod_install_state/modInstallState";
import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import { browseModsTracking } from "@/test-utils/browseModsTracking";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { queryClient } from "@/util/queryClient";

const mocks = vi.hoisted(() => ({
  installs: true,
  install: vi.fn(),
  download: vi.fn(),
  show: vi.fn(),
  gameId: "skyrimse",
  states: {} as Record<number, ModInstallState>,
}));

vi.mock("react-redux", () => ({
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({ settings: { automation: { install: mocks.installs }, interface: {} } }),
}));
vi.mock("@/util/selectors", () => ({ activeGameId: () => mocks.gameId }));
vi.mock("@/extensions/mod_management/util/show_mod_on_mods_page/showModOnModsPage", () => ({
  showModOnModsPage: mocks.show,
}));
vi.mock("@/extensions/nexus_integration/util/download_and_install/downloadAndInstall", () => ({
  downloadAndInstallNexusFile: mocks.install,
  downloadNexusFile: mocks.download,
}));
vi.mock("@/extensions/nexus_integration/util/UIDs", () => ({
  makeFileUID: ({ gameId, fileId }: { gameId: string; fileId: string }) => `${gameId}-${fileId}`,
}));
vi.mock("@/util/useRelativeTime", () => ({ useRelativeTime: () => "2 days ago" }));
vi.mock("@/extensions/browse_nexus/hooks/use_mod_install_state/useModInstallState.hook", () => ({
  useModInstallState: ({ fileId }: { fileId: number }) => mocks.states[fileId] ?? { kind: "none" },
}));

import { MainFileCard } from "./MainFileCard";

const mod = {
  id: "7340033",
  game_scoped_id: "1",
  game: { id: "1704", domain_name: "skyrimspecialedition" },
  name: "SkyUI",
} as unknown as ModSummary;

const file = (file_id: number, extra: Partial<IFileInfo> = {}) =>
  ({
    file_id,
    name: `File ${file_id}`,
    version: "1.0",
    description: "[b]Hello[/b]",
    size_kb: 2048,
    uploaded_timestamp: 1_700_000_000,
    is_primary: false,
    ...extra,
  }) as IFileInfo;

let tracking: ReturnType<typeof browseModsTracking>;
let emit: ReturnType<typeof vi.fn>;
let openUrl: ReturnType<typeof vi.fn>;
let onLeave: ReturnType<typeof vi.fn<() => void>>;

const renderCards = (...files: IFileInfo[]) => {
  const client = new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });
  tracking = browseModsTracking();
  emit = vi.fn();
  onLeave = vi.fn<() => void>();
  const api = {
    showErrorNotification: vi.fn(),
    events: { emit },
    store: { dispatch: vi.fn() },
  } as unknown as IExtensionApi;

  return render(
    <QueryClientProvider client={client}>
      {files.map((f) => (
        <MainFileCard key={f.file_id} api={api} file={f} mod={mod} onLeave={onLeave} />
      ))}
    </QueryClientProvider>,
    { wrapper: tracking.wrapper },
  );
};

const action = (id: number) => screen.getByTestId(`main-file-card-action-${id}`);

const stubOverflow = (scrollHeight: number, clientHeight: number) => {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get: () => scrollHeight,
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => clientHeight,
  });
};

describe("MainFileCard", () => {
  beforeEach(() => {
    mocks.installs = true;
    mocks.states = {};
    mocks.install.mockReset();
    mocks.download.mockReset();
    mocks.show.mockReset();
    openUrl = vi.fn();
    window.api.shell = { openUrl } as unknown as typeof window.api.shell;
  });

  afterEach(() => {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollHeight;
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
  });

  it("installs its own file with 1-click, counting it by the file's uid", async () => {
    mocks.install.mockReturnValue(new Promise(() => undefined));
    renderCards(file(42));

    await userEvent.click(action(42));

    await waitFor(() => expect(mocks.install).toHaveBeenCalledTimes(1));
    expect(mocks.install.mock.calls[0][1]).toMatchObject({ modId: "1", fileId: "42" });
    expect(onLeave).not.toHaveBeenCalled();
    expect(tracking.tracked("browse_mods_one_click_clicked").map((e) => e.properties)).toEqual([
      { mod_uid: "7340033", file_uid: "1704-42", action: "install" },
    ]);
  });

  it("only downloads when the user's settings don't install", async () => {
    mocks.installs = false;
    mocks.download.mockReturnValue(new Promise(() => undefined));
    renderCards(file(42));

    await userEvent.click(action(42));

    await waitFor(() => expect(mocks.download).toHaveBeenCalledTimes(1));
    expect(mocks.install).not.toHaveBeenCalled();
  });

  it("installs a downloaded file from its download", async () => {
    mocks.states = { 42: { kind: "downloaded", downloadId: "dl1", downloadCount: 1 } };
    renderCards(file(42));

    await userEvent.click(action(42));

    expect(emit).toHaveBeenCalledWith("start-install-download", "dl1");
    expect(onLeave).not.toHaveBeenCalled();
    expect(tracking.tracked("browse_mods_install_clicked")).toHaveLength(1);
  });

  it("shows an installed file's mod on the Mods page, closing the picker", async () => {
    mocks.states = { 42: { kind: "installed", mod: { id: "m1" } as never, installedCount: 1 } };
    renderCards(file(42));

    await userEvent.click(action(42));

    expect(mocks.show).toHaveBeenCalledWith(expect.anything(), "m1");
    expect(onLeave).toHaveBeenCalled();
    expect(tracking.tracked("browse_mods_view_installed_clicked")).toHaveLength(1);
  });

  it("badges a primary file that's installed with both", () => {
    mocks.states = { 42: { kind: "installed", mod: { id: "m1" } as never, installedCount: 1 } };
    renderCards(file(42, { is_primary: true }));

    const card = screen.getByTestId("main-file-card-42");

    expect(card).toHaveTextContent("Primary file");
    expect(card).toHaveTextContent("Installed");
  });

  it("badges a downloaded file", () => {
    mocks.states = { 42: { kind: "downloaded", downloadId: "dl1", downloadCount: 1 } };
    renderCards(file(42));

    expect(screen.getByTestId("main-file-card-42")).toHaveTextContent("Downloaded");
  });

  it("leaves another card usable while one installs", async () => {
    mocks.install.mockReturnValue(new Promise(() => undefined));
    renderCards(file(42), file(43));

    await userEvent.click(action(42));

    await waitFor(() => expect(action(42)).toBeDisabled());
    expect(action(43)).toBeEnabled();
  });

  it("labels its action by its file for a screen reader", () => {
    renderCards(file(42), file(43));

    const group = screen.getByRole("group", { name: "File 43" });

    expect(within(group).getByRole("button")).toBe(action(43));
  });

  it("shows a file that's installing from its download as Install, loading", () => {
    mocks.states = { 42: { kind: "installing" } };
    renderCards(file(42));

    expect(action(42)).toBeDisabled();
    expect(action(42)).toHaveAccessibleName("Install");
  });

  it("offers the full description on the site when it's cut off", async () => {
    stubOverflow(80, 40);
    renderCards(file(42));

    await userEvent.click(await screen.findByTestId("main-file-card-description-link-42"));

    expect(openUrl).toHaveBeenCalledWith(
      "https://www.nexusmods.com/skyrimspecialedition/mods/1?tab=files&file_id=42&nmm=1",
    );
  });

  it("has no link to the full description when it fits", () => {
    stubOverflow(40, 40);
    renderCards(file(42));

    expect(screen.queryByTestId("main-file-card-description-link-42")).toBeNull();
  });

  it("says the file's exact size, on hover", async () => {
    renderCards(file(42));

    await userEvent.hover(screen.getByTestId("main-file-card-size"));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(/^File size: /);
  });

  it("says when the file was uploaded, on hover", async () => {
    renderCards(file(42));

    await userEvent.hover(screen.getByTestId("main-file-card-uploaded"));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(/^Uploaded /);
  });
});
