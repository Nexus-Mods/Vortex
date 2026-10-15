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
    session: {
      discovery: { running: false },
      gameMode: {
        known: [] as Array<{ id: string; name: string }>,
        detectedGames: [] as Array<{ gameUid: string; extension?: object }>,
        detectedGamesStatus: "success" as "running" | "failed" | "success" | undefined,
      },
    },
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
// the four empty states this section picks, so the lists are stubbed out. The grid's
// stand-in also shows the detected stores it was handed.
vi.mock("../GamesGrid", () => ({
  GamesGrid: ({
    detectedStores,
    games,
  }: {
    detectedStores?: Record<string, string>;
    games: IGameStored[];
  }) => (
    <div data-stores={JSON.stringify(detectedStores)} data-testid="games-grid">
      {games.map((iter) => iter.name).join(",")}
    </div>
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

/**
 * Fails the scan at the step given; detection is the endpoint, discovery the local search.
 * A detection failure is recorded in the store's status, as the request would.
 */
const scanFailing = (err: Error, failure: "discovery" | "detection" = "detection") =>
  emit.mockImplementation(
    (event: string, cb?: (ids: string[], error?: Error, step?: string) => void) => {
      if (event === "start-quick-discovery") {
        if (failure === "detection") {
          state.current.session.gameMode.detectedGamesStatus = "failed";
        }
        cb?.([], err, failure);
      }
    },
  );

const renderComponent = (props: Partial<SectionProps> = {}) => {
  const onBrowseSupported = vi.fn();
  const element = (overrides: Partial<SectionProps> = {}) => (
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
        ...overrides,
      } as SectionProps)}
    />
  );

  const { rerender } = render(element());

  // The mocked selectors read the store on render, so a store change needs one.
  return {
    onBrowseSupported,
    rerender: (overrides?: Partial<SectionProps>) => rerender(element(overrides)),
  };
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

  it("hands the grid the store each game was detected on", () => {
    renderComponent({ count: "1", detectedStores: { skyrim: "steam" }, games: [game("skyrim")] });

    expect(screen.getByTestId("games-grid")).toHaveAttribute(
      "data-stores",
      JSON.stringify({ skyrim: "steam" }),
    );
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

    it("puts favourite games ahead of the section's own order", () => {
      state.current.settings.gameMode.discovered = detected;
      renderComponent({ ...threeGames, favourites: ["zulu"] });
      expect(screen.getByTestId("games-grid")).toHaveTextContent("zulu,mike,alpha");
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

    it("ignores the result of a scan the reader cancelled", async () => {
      let finish = () => undefined as void;
      emit.mockImplementation((event: string, cb?: (ids: string[]) => void) => {
        if (event === "start-quick-discovery") {
          finish = () => cb?.(["fallout4"]);
        }
      });
      renderComponent({ count: "1", games: [game("skyrim")] });

      await userEvent.click(screen.getByRole("button", { name: "Refresh scan" }));
      await userEvent.click(screen.getByRole("button", { name: "Cancel scan" }));
      finish();
      await Promise.resolve();

      expect(sendNotification).not.toHaveBeenCalled();
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

    it("counts only games that weren't already detected", async () => {
      state.current.session.gameMode.detectedGames = [{ gameUid: "skyrim", extension: {} }];
      scanResolving(["skyrim"]);
      renderComponent();

      await userEvent.click(screen.getByRole("button", { name: "Retry scan" }));

      expect(await screen.findByText("Games detected")).toBeInTheDocument();
      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ message: "No new games found", type: "info" }),
      );
    });

    // Discovery lists games the response can't name, such as an extension still in
    // development, so a scan that reports one of those again has found nothing new.
    it("counts a game only discovery found as already detected", async () => {
      state.current.session.gameMode.known = [{ id: "emberville", name: "Emberville" }];
      state.current.settings.gameMode.discovered = {
        emberville: { path: "C:/Games/Emberville" },
      };
      scanResolving(["emberville"]);
      renderComponent({ count: "1", games: [game("emberville")] });

      await userEvent.click(screen.getByRole("button", { name: "Refresh scan" }));

      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ message: "No new games found", type: "info" }),
      );
    });

    // Without an earlier result there's nothing to tell new games from.
    it("reports no count before any detection has succeeded", async () => {
      state.current.session.gameMode.detectedGamesStatus = undefined;
      scanResolving(["skyrim", "fallout4"]);
      renderComponent();

      await userEvent.click(screen.getByRole("button", { name: "Retry scan" }));

      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Game detection finished", type: "info" }),
      );
    });

    // Only a successful detection stores games, so they're still a result after a later failure.
    it("still counts against stored games after a later detection failed", async () => {
      state.current.session.gameMode.detectedGamesStatus = "failed";
      state.current.session.gameMode.detectedGames = [{ gameUid: "skyrim", extension: {} }];
      scanResolving(["skyrim", "fallout4"]);
      renderComponent();

      await userEvent.click(screen.getByRole("button", { name: "Retry scan" }));

      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Found {{count}} new game", type: "success" }),
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

  describe("detection status", () => {
    it("shows detection running as scanning", () => {
      state.current.session.gameMode.detectedGamesStatus = "running";
      renderComponent();
      expect(screen.getByText("Scanning for installed games...")).toBeInTheDocument();
    });

    it("shows a failed detection as the connection panel, with a retry", async () => {
      state.current.session.gameMode.detectedGamesStatus = "failed";
      renderComponent();
      expect(screen.getByText("Can't detect games right now")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Retry scan" }));
      expect(emit).toHaveBeenCalledWith("start-quick-discovery", expect.any(Function));
    });

    it("keeps the panel when games are already added", () => {
      state.current.session.gameMode.detectedGamesStatus = "failed";
      renderComponent({ count: "0", games: [], hasAddedGames: true });
      expect(screen.getByText("Can't detect games right now")).toBeInTheDocument();
    });
  });

  describe("a failed scan", () => {
    it("says it couldn't check, in place of a count", async () => {
      scanFailing(new Error("no connection"));
      renderComponent({ count: "1", games: [game("skyrim")] });

      await userEvent.click(screen.getByRole("button", { name: "Refresh scan" }));

      expect(sendNotification).toHaveBeenCalledOnce();
      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Couldn't check for new games. Check your internet connection.",
          type: "error",
          displayMS: 4000,
        }),
      );
    });

    it("says so in the description when cards fill the section", async () => {
      scanFailing(new Error("no connection"));
      const { rerender } = renderComponent({ count: "1", games: [game("skyrim")] });

      await userEvent.click(screen.getByRole("button", { name: "Refresh scan" }));
      rerender();

      expect(
        screen.getByText(
          "Can't detect games right now. Check your internet connection and try again.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByTestId("games-grid")).toHaveTextContent("skyrim");
      expect(sendNotification).not.toHaveBeenCalledWith(
        expect.objectContaining({ message: "No new games found" }),
      );
    });

    it("says so in the description while a search fills the section", () => {
      state.current.session.gameMode.detectedGamesStatus = "failed";
      renderComponent({ count: "0/1", filtering: true });

      expect(screen.getByText("No games found")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Can't detect games right now. Check your internet connection and try again.",
        ),
      ).toBeInTheDocument();
    });

    it("drops the description once detection recovers", () => {
      state.current.session.gameMode.detectedGamesStatus = "failed";
      const { rerender } = renderComponent({ count: "1", games: [game("skyrim")] });

      state.current.session.gameMode.detectedGamesStatus = "success";
      rerender();

      expect(screen.getByText("Installed games you haven't added yet.")).toBeInTheDocument();
    });

    // Discovery raises its own error notification, and isn't a connection problem.
    it("leaves a discovery failure to its own notification", async () => {
      scanFailing(new Error("disk"), "discovery");
      renderComponent({ count: "1", games: [game("skyrim")] });

      await userEvent.click(screen.getByRole("button", { name: "Refresh scan" }));

      expect(sendNotification).not.toHaveBeenCalled();
    });

    // The store's status is the record of a detection failure, so it clears with it.
    it("drops the panel once detection recovers in the background", async () => {
      scanFailing(new Error("no connection"));
      const { rerender } = renderComponent();
      await userEvent.click(screen.getByRole("button", { name: "Retry scan" }));
      expect(await screen.findByText("Can't detect games right now")).toBeInTheDocument();

      state.current.session.gameMode.detectedGamesStatus = "success";
      rerender();

      expect(screen.getByText("No installed games detected")).toBeInTheDocument();
    });

    it("keeps a discovery failure's panel until the next scan", async () => {
      scanFailing(new Error("disk"), "discovery");
      const { rerender } = renderComponent();
      await userEvent.click(screen.getByRole("button", { name: "Retry scan" }));
      rerender();

      expect(await screen.findByText("Can't detect games right now")).toBeInTheDocument();
    });

    it("surfaces the failure and lets the reader retry", async () => {
      scanFailing(new Error("no connection"));
      renderComponent();

      await userEvent.click(screen.getByRole("button", { name: "Retry scan" }));
      expect(await screen.findByText("Can't detect games right now")).toBeInTheDocument();
      expect(sendNotification).not.toHaveBeenCalledWith(
        expect.objectContaining({ message: "No new games found" }),
      );

      // retrying clears the failure rather than leaving the error on screen
      state.current.session.gameMode.detectedGamesStatus = "success";
      scanResolving();
      await userEvent.click(screen.getByRole("button", { name: "Retry scan" }));
      expect(await screen.findByText("No installed games detected")).toBeInTheDocument();
    });
  });
});
