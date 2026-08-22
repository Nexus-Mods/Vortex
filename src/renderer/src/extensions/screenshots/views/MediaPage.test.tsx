import { screen, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { expect, it, describe, vi, beforeEach } from "vitest";

import type { IExtensionApi } from "@/types/api";

import MediaPage from "./MediaPage";

vi.mock("../hooks/GameMediaHook", () => ({
  default: vi.fn(),
}));

const { dispatch, mockUseDispatch } = vi.hoisted(() => {
  const dispatch = vi.fn();

  return {
    dispatch,
    mockUseDispatch: vi.fn(() => dispatch),
  };
});

vi.mock("react-redux", async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...(actual as object),
    useDispatch: mockUseDispatch,
  };
});

import { setOpenMainPage, setSettingsPage } from "@/actions";

import useGameMedia from "../hooks/GameMediaHook";
import type { GameMediaItem } from "../util/mediaTypes";

const mockedUseGameMedia = vi.mocked(useGameMedia);

const baseMediaState: ReturnType<typeof useGameMedia> = {
  isLoading: false,
  isError: false,
  error: null,
  allSources: {},
  items: [],
  forceCollect: vi.fn().mockResolvedValue(undefined),
  game: { id: "", name: "Test Game", requiredFiles: [], executable: "." },
  disabledSources: [],
  discovery: {},
  customSources: {},
  defaultSources: {},
};

vi.mock("../components/MediaListItem", () => ({
  default: ({ item, onClick }: { item: GameMediaItem; onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      {item.name}
    </button>
  ),
}));

vi.mock("./MediaSingleView", () => ({
  default: ({ entry }: { entry: GameMediaItem }) => (
    <div data-testid="media-single-view">{entry.name}</div>
  ),
}));

const renderComponent = () => {
  const translate = vi.fn();
  const sendNotification = vi.fn();

  const api: Partial<IExtensionApi> = {
    translate,
    sendNotification,
  };

  render(<MediaPage api={api as IExtensionApi} />);
};

describe("MediaPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseGameMedia.mockReturnValue(baseMediaState);
  });

  it("calls forceCollect when refresh button is pressed", async () => {
    const forceCollect = vi.fn().mockResolvedValue(undefined);
    mockedUseGameMedia.mockReturnValue({ ...baseMediaState, forceCollect });

    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByTestId("refresh-media"));
    expect(forceCollect).toHaveBeenCalledOnce();
  });

  it("disables refresh while loading", () => {
    mockedUseGameMedia.mockReturnValue({ ...baseMediaState, isLoading: true });
    renderComponent();
    expect(screen.getByTestId("refresh-media")).toBeDisabled();
  });

  it("dispatches setOpenMainPage and setSettingsPage when settings button is pressed", async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.click(screen.getByTestId("open-media-settings"));

    expect(dispatch).toHaveBeenCalledWith(setOpenMainPage("game_settings", false));
    expect(dispatch).toHaveBeenCalledWith(setSettingsPage("Media"));
  });

  it("show the correct tab counts for filtered tabs", () => {
    const items = [
      {
        id: "one",
        name: "one.png",
        path: "/media/one.png",
        sourceId: "screenshots",
        type: "image" as const,
      },
      {
        id: "two",
        name: "two.mp4",
        path: "/media/two.mp4",
        sourceId: "videos",
        type: "video" as const,
      },
    ];

    mockedUseGameMedia.mockReturnValue({
      ...baseMediaState,
      allSources: {
        screenshots: { name: "Screenshots", path: "/screenshots" },
        videos: { name: "Videos", path: "/videos" },
      },
      items,
    });

    renderComponent();
    expect(screen.getByRole("tab", { name: /Screenshots.*1/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Videos.*1/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /All.*2/ })).toBeInTheDocument();
  });

  it("does not render tabs for disabled sources", () => {
    mockedUseGameMedia.mockReturnValue({
      ...baseMediaState,
      allSources: {
        screenshots: { name: "Screenshots", path: "/screenshots" },
        videos: { name: "Videos", path: "/videos" },
      },
      disabledSources: ["videos"],
    });

    renderComponent();

    expect(screen.getByRole("tab", { name: /Screenshots/ })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Videos/ })).not.toBeInTheDocument();
  });

  it("shows a no results state when nothing is found", () => {
    mockedUseGameMedia.mockReturnValue({
      ...baseMediaState,
      items: [],
    });

    renderComponent();
    expect(screen.getByTestId("no-results-refresh")).toBeInTheDocument();
  });

  it("switches to MediaSingleView when an item is clicked", async () => {
    const item = {
      id: "one",
      name: "one.png",
      path: "/media/one.png",
      sourceId: "screenshots",
      type: "image" as const,
    };

    mockedUseGameMedia.mockReturnValue({
      ...baseMediaState,
      allSources: {
        screenshots: { name: "Screenshots", path: "/screenshots" },
      },
      items: [item],
    });

    const user = userEvent.setup();
    renderComponent();

    await user.click(screen.getByRole("button", { name: "one.png" }));

    expect(screen.getByTestId("media-single-view")).toHaveTextContent("one.png");
  });
});
