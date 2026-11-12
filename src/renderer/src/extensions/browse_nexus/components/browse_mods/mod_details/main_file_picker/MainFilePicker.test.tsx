import type { IFileInfo } from "@nexusmods/nexus-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import { browseModsTracking } from "@/test-utils/browseModsTracking";
import { settleTransitions } from "@/test-utils/transitions";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { queryClient } from "@/util/queryClient";

const mocks = vi.hoisted(() => ({ install: vi.fn() }));

vi.mock("react-redux", () => ({
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({ settings: { automation: { install: true }, interface: {} } }),
}));
vi.mock("@/util/selectors", () => ({ activeGameId: () => "skyrimse" }));
vi.mock("@/extensions/nexus_integration/util/download_and_install/downloadAndInstall", () => ({
  downloadAndInstallNexusFile: mocks.install,
  downloadNexusFile: mocks.install,
}));
vi.mock("@/extensions/nexus_integration/util/UIDs", () => ({ makeFileUID: () => "uid" }));
vi.mock("@/util/useRelativeTime", () => ({ useRelativeTime: () => "2 days ago" }));
vi.mock("@/extensions/browse_nexus/hooks/use_mod_install_state/useModInstallState.hook", () => ({
  useModInstallState: () => ({ kind: "none" }),
}));

import { MainFilePicker } from "./MainFilePicker";

const mod = {
  id: "7340033",
  game_scoped_id: "1",
  game: { id: "1704", domain_name: "skyrimspecialedition" },
  name: "SkyUI",
} as unknown as ModSummary;

const file = (file_id: number) =>
  ({
    file_id,
    name: `File ${file_id}`,
    version: "1.0",
    description: "",
    size_kb: 1,
    uploaded_timestamp: 1,
    is_primary: false,
  }) as IFileInfo;

const renderPicker = (files = [file(3), file(1), file(2)]) => {
  const onClose = vi.fn();
  const tracking = browseModsTracking();
  const api = {
    showErrorNotification: vi.fn(),
    events: { emit: vi.fn() },
  } as unknown as IExtensionApi;
  const client = new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });

  render(
    <QueryClientProvider client={client}>
      <MainFilePicker api={api} files={files} isOpen mod={mod} onClose={onClose} />
    </QueryClientProvider>,
    { wrapper: tracking.wrapper },
  );

  return { onClose };
};

describe("MainFilePicker", () => {
  it("is a dialog named by its title", async () => {
    renderPicker();

    expect(screen.getByRole("dialog", { name: "Choose a file to install" })).toBeInTheDocument();

    await settleTransitions();
  });

  it("lists a card per file, in the order given", async () => {
    renderPicker();

    const ids = screen.getAllByTestId(/^main-file-card-\d+$/).map((card) => card.dataset.testid);

    expect(ids).toEqual(["main-file-card-3", "main-file-card-1", "main-file-card-2"]);

    await settleTransitions();
  });

  it("says how many main files there are", async () => {
    renderPicker();

    expect(screen.getByTestId("main-file-picker-summary")).toHaveTextContent(
      "{{mod}} has {{count}} main files. Choose which you'd like to install.",
    );

    await settleTransitions();
  });

  it("says there's one main file when there's one", async () => {
    renderPicker([file(1)]);

    expect(screen.getByTestId("main-file-picker-summary")).toHaveTextContent(
      "{{mod}} has 1 main file. Choose which you'd like to install.",
    );

    await settleTransitions();
  });

  it("closes from its Close button", async () => {
    const { onClose } = renderPicker();

    await userEvent.click(screen.getByTestId("main-file-picker-close"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays open when a card's action runs", async () => {
    mocks.install.mockReturnValue(new Promise(() => undefined));
    const { onClose } = renderPicker();

    await userEvent.click(screen.getByTestId("main-file-card-action-1"));

    expect(onClose).not.toHaveBeenCalled();
  });
});
