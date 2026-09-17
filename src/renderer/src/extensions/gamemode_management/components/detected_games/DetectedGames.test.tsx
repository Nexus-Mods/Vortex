import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import type * as ReactReduxTypes from "react-redux";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { IGameStored } from "../../types/IGameStored";

const { baseState, dispatch, emit, sendNotification, state } = vi.hoisted(() => {
  // Enough of the store for the selectors this section reads, activeGameId included.
  const baseState = () => ({
    persistent: { profiles: {} },
    session: { discovery: { running: false } },
    settings: {
      gameMode: {
        discovered: {},
        pickerLayout: "small",
        sortDetected: "recentlydetected",
      },
      profiles: { activeProfileId: undefined },
    },
  });

  return {
    baseState,
    dispatch: vi.fn(),
    emit: vi.fn(),
    sendNotification: vi.fn(),
    state: { current: baseState() },
  };
});

vi.mock("@/contexts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useMainContext: () => ({ api: { events: { emit }, sendNotification } }),
}));

vi.mock("react-redux", async () => {
  const actual = await vi.importActual<typeof ReactReduxTypes>("react-redux");

  return {
    ...actual,
    useDispatch: () => dispatch,
    useSelector: (selector: (input: unknown) => unknown) => selector(state.current),
  };
});

// The tiles are the grid's concern and pull in the store; this file is about which of
// the four empty states this section picks, so the lists are stubbed out.
vi.mock("../GamesGrid", () => ({
  GamesGrid: ({ games }: { games: IGameStored[] }) => (
    <div data-testid="games-grid">{games.map((iter) => iter.name).join(",")}</div>
  ),
}));

vi.mock("../GamesList", () => ({
  GamesList: ({ games }: { games: IGameStored[] }) => (
    <div data-testid="games-list">{games.map((iter) => iter.name).join(",")}</div>
  ),
}));

import { DetectedGames } from "./DetectedGames";

// --- Helpers ---

type SectionProps = React.ComponentProps<typeof DetectedGames>;

const game = (id: string): IGameStored => ({
  id,
  name: id,
  executable: undefined,
  extensionPath: undefined,
  requiredFiles: [],
});

/** Answers the `start-quick-discovery` emit the way the extension would. */
const scanResolving = (gameIds: string[] = []) =>
  emit.mockImplementation((event: string, cb?: (ids: string[], err?: Error) => void) => {
    if (event === "start-quick-discovery") {
      cb?.(gameIds);
    }
  });

/** Leaves the scan in flight, so the scanning UI stays put. */
const scanPending = () => emit.mockImplementation(() => undefined);

const scanFailing = (err: Error) =>
  emit.mockImplementation((event: string, cb?: (ids: string[], error?: Error) => void) => {
    if (event === "start-quick-discovery") {
      cb?.([], err);
    }
  });

const renderComponent = (props: Partial<SectionProps> = {}) => {
  const onBrowseSupported = vi.fn();

  render(
    <DetectedGames
      {...({
        count: "0",
        filtering: false,
        games: [],
        hasAddedGames: false,
        onBrowseGameLocation: vi.fn(),
        onBrowseSupported,
        onRefreshGameInfo: vi.fn(),
        ...props,
      } as SectionProps)}
    />,
  );

  return { onBrowseSupported };
};

// --- Tests ---

describe("DetectedGames", () => {
  beforeEach(() => {
    dispatch.mockReset();
    emit.mockReset();
    sendNotification.mockReset();
    scanResolving();
    state.current = baseState();
  });

  it("hands its games to the grid", () => {
    renderComponent({ count: "1", games: [game("skyrim")] });
    expect(screen.getByTestId("games-grid")).toHaveTextContent("skyrim");
  });

  it("hands them to the list when the layout says so", () => {
    state.current.settings.gameMode.pickerLayout = "list";
    renderComponent({ count: "1", games: [game("skyrim")] });
    expect(screen.getByTestId("games-list")).toHaveTextContent("skyrim");
  });

  describe("ordering", () => {
    // Names run opposite to the timestamps, so the two orders can't be confused.
    const detected = {
      alpha: { path: "C:/alpha", timestamp: 1_000 },
      mike: { path: "C:/mike", timestamp: 3_000 },
      zulu: { path: "C:/zulu" },
    };

    const threeGames = { count: "3", games: [game("alpha"), game("zulu"), game("mike")] };

    it("puts the most recently detected first by default", () => {
      state.current.settings.gameMode.discovered = detected;
      renderComponent(threeGames);
      expect(screen.getByTestId("games-grid")).toHaveTextContent("mike,alpha,zulu");
    });

    // Games discovered before the timestamp existed have none; they sort last rather
    // than jumping to the top as a zero would if the comparison were reversed.
    it("sorts a game with no timestamp oldest", () => {
      state.current.settings.gameMode.discovered = { alpha: {}, zulu: { timestamp: 3_000 } };
      renderComponent({ count: "2", games: [game("alpha"), game("zulu")] });
      expect(screen.getByTestId("games-grid")).toHaveTextContent("zulu,alpha");
    });

    it("sorts by name when the setting says so", () => {
      state.current.settings.gameMode.discovered = detected;
      state.current.settings.gameMode.sortDetected = "alphabetical";
      renderComponent(threeGames);
      expect(screen.getByTestId("games-grid")).toHaveTextContent("alpha,mike,zulu");
    });

    it("records the reader's choice of order", async () => {
      renderComponent({ count: "1", games: [game("skyrim")] });

      await userEvent.click(screen.getByRole("button", { name: /Recently detected/ }));
      await userEvent.click(screen.getByRole("option", { name: "Name A-Z" }));

      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ payload: "alphabetical", type: "SET_SORT_DETECTED" }),
      );
    });
  });

  describe("the header controls", () => {
    it("starts a scan from an icon button labelled for screen readers", async () => {
      renderComponent({ count: "1", games: [game("skyrim")] });

      await userEvent.click(screen.getByRole("button", { name: "Refresh scan" }));
      expect(emit).toHaveBeenCalledWith("start-quick-discovery", expect.any(Function));
    });

    it("swaps that button for a spinner and a cancel while the scan runs", async () => {
      scanPending();
      renderComponent({ count: "1", games: [game("skyrim")] });

      await userEvent.click(screen.getByRole("button", { name: "Refresh scan" }));

      expect(screen.queryByRole("button", { name: "Refresh scan" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cancel scan" })).toBeInTheDocument();
    });

    // Rescanning used to drop the tiles and bounce the section back to its empty
    // scanning state, which made the results flash away under the reader.
    it("keeps the tiles on screen while a rescan runs", async () => {
      scanPending();
      renderComponent({ count: "1", games: [game("skyrim")] });

      await userEvent.click(screen.getByRole("button", { name: "Refresh scan" }));

      expect(screen.getByTestId("games-grid")).toHaveTextContent("skyrim");
      expect(screen.queryByText("Scanning for installed games...")).not.toBeInTheDocument();
    });
  });

  // Someone already managing games has no need of a panel explaining detection.
  describe("empty, but games are already added", () => {
    const quiet = { count: "0", games: [], hasAddedGames: true };

    it("reports it in the header and drops the no-results panel", () => {
      renderComponent(quiet);

      expect(screen.getByText("New games detected")).toBeInTheDocument();
      expect(
        screen.getByText("We'll show any installed games you haven't added yet here."),
      ).toBeInTheDocument();
      expect(screen.queryByText("No installed games detected")).not.toBeInTheDocument();
    });

    it("still offers the scan, without a sort there is nothing to order", async () => {
      renderComponent(quiet);

      await userEvent.click(screen.getByRole("button", { name: "Refresh scan" }));
      expect(emit).toHaveBeenCalledWith("start-quick-discovery", expect.any(Function));
      expect(screen.queryByRole("button", { name: /Recently detected/ })).not.toBeInTheDocument();
    });

    it("swaps the scan for a spinner and a cancel, still without a panel", async () => {
      scanPending();
      renderComponent(quiet);

      await userEvent.click(screen.getByRole("button", { name: "Refresh scan" }));

      expect(screen.getByRole("button", { name: "Cancel scan" })).toBeInTheDocument();
      expect(screen.queryByText("Scanning for installed games...")).not.toBeInTheDocument();
      expect(screen.getByText("New games detected")).toBeInTheDocument();
    });

    // A fault is worth a panel even when an empty result isn't.
    it("still shows the panel when the scan failed", async () => {
      scanFailing(new Error("no connection"));
      renderComponent(quiet);

      await userEvent.click(screen.getByRole("button", { name: "Refresh scan" }));
      expect(await screen.findByText("Can't detect games right now")).toBeInTheDocument();
    });

    it("keeps the full empty state when nothing has been added yet", () => {
      renderComponent({ count: "0", games: [], hasAddedGames: false });

      expect(screen.getByText("No installed games detected")).toBeInTheDocument();
      expect(screen.getByText("Games detected")).toBeInTheDocument();
    });
  });

  describe("empty states", () => {
    it("offers a scan and the catalogue when nothing is detected", async () => {
      const { onBrowseSupported } = renderComponent();
      expect(screen.getByText("No installed games detected")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Retry scan" }));
      expect(emit).toHaveBeenCalledWith("start-quick-discovery", expect.any(Function));

      await userEvent.click(screen.getByRole("button", { name: "Browse games" }));
      expect(onBrowseSupported).toHaveBeenCalledOnce();
    });

    // A search that matched nothing isn't a detection problem, so it must not offer a scan.
    it("reports a search miss ahead of the no-games state", () => {
      renderComponent({ filtering: true });
      expect(screen.getByText("No games found")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Retry scan" })).not.toBeInTheDocument();
    });

    it("shows the deep search as scanning, and can cancel it", async () => {
      state.current.session.discovery.running = true;
      renderComponent();
      expect(screen.getByText("Scanning for installed games...")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Cancel scan" }));
      expect(emit).toHaveBeenCalledWith("cancel-game-scan");
    });

    // With results on screen the spinner and cancel move up into the header, so the
    // tiles aren't replaced by a loading state mid-scan.
    it("moves the scan controls into the header once there are tiles", async () => {
      state.current.session.discovery.running = true;
      renderComponent({ count: "1", games: [game("skyrim")] });

      expect(screen.getByTestId("games-grid")).toHaveTextContent("skyrim");
      expect(screen.queryByText("Scanning for installed games...")).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Cancel scan" }));
      expect(emit).toHaveBeenCalledWith("cancel-game-scan");
    });

    // Scanning wins over a search miss only when nothing is being filtered.
    it("keeps reporting a search miss while a scan runs", () => {
      state.current.session.discovery.running = true;
      renderComponent({ filtering: true });
      expect(screen.getByText("No games found")).toBeInTheDocument();
      expect(screen.queryByText("Scanning for installed games...")).not.toBeInTheDocument();
    });
  });

  describe("what a finished scan reports", () => {
    it("says how many are new", async () => {
      scanResolving(["skyrim", "fallout4"]);
      renderComponent();

      await userEvent.click(screen.getByRole("button", { name: "Retry scan" }));

      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Found {{count}} new game", type: "success" }),
      );
    });

    // The find is marked out by light rather than by words alone, and that lighting is
    // CSS the DOM under test can't see - so the section flags it for us instead.
    it("lights the section while anything is waiting to be added", () => {
      renderComponent({ count: "1", games: [game("skyrim")] });

      expect(screen.getByTestId("detected-games-lit")).toBeInTheDocument();
      expect(screen.getByText("New games detected")).toBeInTheDocument();
    });

    // A scan that reports only what was already on the list leaves the section as it found it.
    it("stays lit when a scan turns up nothing new", async () => {
      renderComponent({ count: "1", games: [game("skyrim")] });

      await userEvent.click(screen.getByRole("button", { name: "Refresh scan" }));

      expect(await screen.findByTestId("detected-games-lit")).toBeInTheDocument();
    });

    it("leaves the section unlit when nothing is detected", () => {
      renderComponent();

      expect(screen.getByText("Games detected")).toBeInTheDocument();
      expect(screen.queryByTestId("detected-games-lit")).not.toBeInTheDocument();
    });

    it("counts only games that weren't already discovered", async () => {
      state.current.settings.gameMode.discovered = { skyrim: { path: "C:/skyrim" } };
      scanResolving(["skyrim"]);
      renderComponent();

      await userEvent.click(screen.getByRole("button", { name: "Retry scan" }));

      expect(await screen.findByText("Games detected")).toBeInTheDocument();
      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ message: "No new games found", type: "info" }),
      );
    });

    it("says so when a scan turns nothing up", async () => {
      renderComponent();

      await userEvent.click(screen.getByRole("button", { name: "Retry scan" }));

      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ message: "No new games found", type: "info" }),
      );
      expect(screen.getByText("Games detected")).toBeInTheDocument();
    });
  });

  describe("a failed scan", () => {
    it("surfaces the failure and lets the reader retry", async () => {
      scanFailing(new Error("no connection"));
      renderComponent();

      await userEvent.click(screen.getByRole("button", { name: "Retry scan" }));
      expect(await screen.findByText("Can't detect games right now")).toBeInTheDocument();
      expect(sendNotification).not.toHaveBeenCalled();

      // retrying clears the failure rather than leaving the error on screen
      scanResolving();
      await userEvent.click(screen.getByRole("button", { name: "Retry scan" }));
      expect(await screen.findByText("No installed games detected")).toBeInTheDocument();
    });
  });
});
