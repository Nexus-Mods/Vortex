import { screen, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { expect, it, describe, vi, beforeEach } from "vitest";

import SettingsMedia from "./SettingsMedia";

/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */

const { dispatch, mockUseDispatch, mockUseSelector, selectorState } = vi.hoisted(() => {
  const dispatch = vi.fn();

  const selectorState = {
    persistent: {
      game_media: {
        disabledSources: {
          "game-1": [] as string[],
        },
      },
    },
  };

  return {
    dispatch,
    mockUseDispatch: vi.fn(() => dispatch),
    mockUseSelector: vi.fn((selector: (state: unknown) => unknown) => selector(selectorState)),
    selectorState,
  };
});

vi.mock("../../../util/selectors", () => ({
  activeGameId: () => "game-1",
}));

vi.mock("react-redux", async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...(actual as object),
    useDispatch: mockUseDispatch,
    useSelector: mockUseSelector,
  };
});

import type { IExtensionApi } from "@/types/api";

vi.mock("../hooks/GameMediaHook", () => ({
  default: vi.fn(),
}));

import { deleteGameMediaSource, setGameMediaSourceEnabled } from "../actions/persistent";
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
    vi.clearAllMocks();
    selectorState.persistent.game_media.disabledSources["game-1"] = [];
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
    selectorState.persistent.game_media.disabledSources["game-1"] = ["sourceB"];
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
    selectorState.persistent.game_media.disabledSources["game-1"] = ["sourceB"];
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

  it("deletes a custom source", async () => {
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

    const user = userEvent.setup();

    renderComponent();
    const deleteButton = screen.getByTestId("source-actions-delete-sourceB");
    await user.click(deleteButton);

    expect(dispatch).toHaveBeenCalledWith(deleteGameMediaSource("game-1", "sourceB"));
  });

  it("opens the add modal", async () => {
    const user = userEvent.setup();
    renderComponent();
    const addButton = screen.getByTestId("add-custom-source");
    await user.click(addButton);

    const modalTitle = screen.queryByText("Add Custom Media Source");

    expect(modalTitle).toBeInTheDocument();
  });

  it("opens the edit modal", async () => {
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

    const user = userEvent.setup();

    renderComponent();
    await user.click(screen.getByTestId("source-actions-edit-sourceB"));

    expect(screen.getByText("Add Custom Media Source")).toBeInTheDocument();
    expect(screen.getByLabelText("Source Name")).toHaveValue("Source B");
    expect(screen.getByLabelText("Description")).toHaveValue("Example source B (Custom)");
    expect(screen.getByLabelText("Folder Path")).toHaveValue("/source/B");
  });
});
