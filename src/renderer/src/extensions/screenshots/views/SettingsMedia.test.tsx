import { screen, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
// import { useSelector } from "react-redux";
import { expect, it, describe, vi, beforeEach } from "vitest";

import SettingsMedia from "./SettingsMedia";

const dispatch = vi.fn();

let disabledSources: string[] = [];

vi.mock("../../../util/selectors", () => ({
  activeGameId: () => "game-1",
}));

vi.mock("react-redux", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-redux")>()),
  useDispatch: () => dispatch,
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({
      persistent: {
        game_media: {
          disabledSources: { "game-1": disabledSources },
        },
      },
    }),
}));

import { IExtensionApi } from "@/types/api";

vi.mock("../hooks/GameMediaHook", () => ({
  default: vi.fn(),
}));

import { setGameMediaSourceEnabled } from "../actions/persistent";
import useGameMedia from "../hooks/GameMediaHook";

const mockedUseGameMedia = vi.mocked(useGameMedia);

const renderComponent = () => {
  const translate = vi.fn();
  const selectDir = vi.fn();

  const api: Partial<IExtensionApi> = {
    translate,
    selectDir,
  };

  render(<SettingsMedia api={api as IExtensionApi} />);
};

describe("SettingsMedia", () => {
  beforeEach(() => {
    disabledSources = [];
    vi.clearAllMocks();
    mockedUseGameMedia.mockReturnValue({ defaultSources: {}, customSources: {} } as any);
  });

  it("renders default and custom sources", async () => {
    mockedUseGameMedia.mockReturnValue({
      defaultSources: {
        sourceA: { name: "Source A", path: "/source/A", description: "Example source A" },
      },
      customSources: {
        sourceB: {
          name: "Source B",
          path: "/source/B",
          description: "Example source B (Custom)",
          custom: true,
        },
      },
    } as any);
    renderComponent();

    const sourceA = await screen.findByText("Source A");
    const sourceADescription = await screen.findByText("Example source A");
    const sourceB = await screen.findByText("Source B");
    const sourceBDescription = await screen.findByText("Example source B (Custom)");
    expect(sourceA).toBeInTheDocument();
    expect(sourceADescription).toBeInTheDocument();
    expect(sourceB).toBeInTheDocument();
    expect(sourceBDescription).toBeInTheDocument();
    // Edit controls should only appear for the custom hook
    expect(screen.queryByTestId("source-actions-delete-sourceA")).not.toBeInTheDocument();
    expect(screen.queryByTestId("source-actions-delete-sourceB")).toBeInTheDocument();
  });

  it("shows an empty state where there are no custom sources", async () => {
    mockedUseGameMedia.mockReturnValue({
      defaultSources: {
        sourceA: { name: "Source A", path: "/source/A", description: "Example source A" },
      },
      customSources: undefined,
    } as any);

    renderComponent();

    expect(await screen.findByText("No custom media sources.")).toBeInTheDocument();
  });

  it("reflects disabled sources", () => {
    disabledSources = ["sourceB"];
    mockedUseGameMedia.mockReturnValue({
      defaultSources: {
        sourceA: { name: "Source A", path: "/source/A" },
        sourceB: { name: "Source B", path: "/source/B" },
      },
      customSources: undefined,
    } as any);

    renderComponent();

    expect(screen.getByTestId("media-source-toggle-sourceA")).toHaveAttribute(
      "aria-checked",
      "true",
    );

    expect(screen.getByTestId("media-source-toggle-sourceB")).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("toggles sources correctly", async () => {
    disabledSources = ["sourceB"];
    mockedUseGameMedia.mockReturnValue({
      defaultSources: {
        sourceA: { name: "Source A", path: "/source/A" },
        sourceB: { name: "Source B", path: "/source/B" },
      },
      customSources: undefined,
    } as any);

    const user = userEvent.setup();

    renderComponent();

    const sourceAToggle = screen.getByTestId("media-source-toggle-sourceA");
    const sourceBToggle = screen.getByTestId("media-source-toggle-sourceB");

    expect(sourceAToggle).toHaveAttribute("aria-checked", "true");
    expect(sourceBToggle).toHaveAttribute("aria-checked", "false");

    await user.click(sourceAToggle);
    await user.click(sourceBToggle);

    expect(dispatch).toHaveBeenCalledWith(setGameMediaSourceEnabled("game-1", "sourceA", false));
    expect(dispatch).toHaveBeenCalledWith(setGameMediaSourceEnabled("game-1", "sourceB", true));
  });

  it("deletes a custom source", () => {});

  it("opens the add modal", () => {});

  it("opens the edit modal", () => {});
});
