import { renderHook } from "@testing-library/react";
import { VortexGameId } from "@vortex/shared";
import type * as React from "react";
import type * as ReactReduxTypes from "react-redux";
import { describe, expect, it, vi } from "vitest";

import type { IAvailableExtension } from "@/types/extensions";
import type { IActionDefinition } from "@/types/IActionDefinition";

const { dispatch, hidden, objects } = vi.hoisted(() => ({
  dispatch: vi.fn(),
  hidden: { current: false },
  objects: { current: [] as IActionDefinition[] },
}));

/** The registrations under test, answered for the group the tile asks for. */
vi.mock("@/ExtensionProvider", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useExtensionObjects: (_registerFunc: unknown, _static: unknown, group: string) =>
    group === "game-managed-buttons" ? objects.current : [],
}));

vi.mock("react-redux", async () => {
  const actual = await vi.importActual<typeof ReactReduxTypes>("react-redux");

  return {
    ...actual,
    useDispatch: () => dispatch,
    useSelector: (selector: (input: unknown) => unknown) =>
      selector({
        settings: { gameMode: { discovered: { skyrimse: { hidden: hidden.current } } } },
      }),
  };
});

import {
  clearGameAddStore,
  setGameAddExtension,
  setGameAddOrigin,
  setGameAddStore,
} from "../../actions/session";
import type { GameSource } from "../../types/GameSource";
import { useGameCardActions } from "./useGameCardActions.hook";

/** The calls dispatched with an action of this kind. */
const dispatched = (action: { getType: () => string }) =>
  dispatch.mock.calls.filter(([dispatchedAction]) => dispatchedAction.type === action.getType());

const definition = (over: Partial<IActionDefinition>): IActionDefinition =>
  ({
    title: "Action",
    position: 105,
    icon: "open-ext",
    action: vi.fn(),
    ...over,
  }) as IActionDefinition;

const actionsFor = (
  definitions: IActionDefinition[],
  showDetails = () => {},
  onMenuAction?: (action: string) => void,
) => {
  objects.current = definitions;
  const { result } = renderHook(() =>
    useGameCardActions("skyrimse", "managed", showDetails, undefined, onMenuAction),
  );

  return result.current;
};

const labels = (definitions: IActionDefinition[]) =>
  actionsFor(definitions).menu[0].map((action) => action.label);

describe("useGameCardActions", () => {
  it("leads with the action registered below the menu split", () => {
    const activate = vi.fn();
    const { primary } = actionsFor([
      definition({ title: "Activate", position: 50, icon: "activate", action: activate }),
    ]);

    primary?.onClick();

    expect(primary?.label).toBe("Activate");
    expect(activate).toHaveBeenCalledWith(["skyrimse"]);
  });

  it("has nothing to lead with when every action belongs in the menu", () => {
    expect(actionsFor([definition({ title: "Stop Managing", position: 150 })]).primary).toBe(
      undefined,
    );
  });

  it("orders its own rows among the registered ones by position", () => {
    expect(
      labels([
        definition({ title: "Stop Managing", position: 150, icon: "delete" }),
        definition({ title: "Manually Set Location", position: 120, icon: "browse" }),
      ]),
    ).toEqual(["Hide", "Game details", "Manually Set Location", "Stop Managing"]);
  });

  it("folds the actions that open something into one row", () => {
    const menu = actionsFor([
      definition({ title: "Open Game Folder", position: 105 }),
      definition({ title: "Open Mod Folder", position: 110 }),
    ]).menu[0];

    expect(menu.map((action) => action.label)).toEqual(["Hide", "Game details", "Open"]);
    expect(menu[2].panel).toBeDefined();
  });

  it("leaves a lone open action as itself rather than a menu of one", () => {
    expect(labels([definition({ title: "Open Game Folder" })])).toEqual([
      "Hide",
      "Game details",
      "Open Game Folder",
    ]);
  });

  it("drops an action its condition rules out, and disables one it objects to", () => {
    expect(labels([definition({ title: "Open Mod Folder", condition: () => false })])).toEqual([
      "Hide",
      "Game details",
    ]);

    const disabled = labels([definition({ title: "Open Mod Folder", condition: () => "No path" })]);

    expect(disabled).toContain("Open Mod Folder");
  });

  it("skips a registration that only the classic tile can draw", () => {
    expect(
      labels([definition({ title: "Hide", position: 100, component: () => null } as never)]),
    ).toEqual(["Hide", "Game details"]);
  });

  it("offers the details dialog to whatever opened it", () => {
    const showDetails = vi.fn();
    const details = actionsFor([], showDetails).menu[0][1];

    details.onClick?.();

    expect(details.label).toBe("Game details");
    expect(showDetails).toHaveBeenCalledOnce();
  });

  // The registered title, not the label: the label is translated, so it would split one
  // action across languages in the data.
  it("names each menu row it runs by a key that doesn't follow the language", () => {
    const onMenuAction = vi.fn();
    const stop = vi.fn();
    const menu = actionsFor(
      [definition({ title: "Stop Managing", position: 150, icon: "delete", action: stop })],
      () => {},
      onMenuAction,
    ).menu[0];

    for (const row of menu) {
      row.onClick?.();
    }

    expect(onMenuAction.mock.calls.map(([action]) => action)).toEqual([
      "hide",
      "game_details",
      "Stop Managing",
    ]);
    // reporting doesn't stand in for the action itself
    expect(stop).toHaveBeenCalledWith(["skyrimse"]);
  });

  it("names the rows inside the Open menu by their own keys, not the Open row's", () => {
    const onMenuAction = vi.fn();
    const folder = vi.fn();
    const open = actionsFor(
      [
        definition({ title: "Open Game Folder", position: 105, action: folder }),
        definition({ title: "Open Mod Folder", position: 110 }),
      ],
      () => {},
      onMenuAction,
    ).menu[0][2];

    const panel = open.panel?.({ close: () => {}, dismiss: () => {} }) as React.ReactElement<{
      actions: Array<Array<{ onClick?: () => void }>>;
    }>;
    panel.props.actions[0][0].onClick?.();

    expect(onMenuAction.mock.calls).toEqual([["Open Game Folder"]]);
    expect(folder).toHaveBeenCalledWith(["skyrimse"]);
  });

  it("names Show as show, so a hide undone can be told apart", () => {
    hidden.current = true;
    const onMenuAction = vi.fn();

    actionsFor([], () => {}, onMenuAction).menu[0][0].onClick?.();

    expect(onMenuAction).toHaveBeenCalledWith("show");

    hidden.current = false;
  });

  it("says Show for a game that's already hidden", () => {
    hidden.current = true;

    expect(labels([])[0]).toBe("Show");

    hidden.current = false;
  });

  describe("the store a tile names", () => {
    const leadWith = (source: GameSource | undefined, store: string | undefined) => {
      const manage = vi.fn();
      objects.current = [
        definition({ title: "Manage", position: 50, icon: "activate", action: manage }),
      ];
      dispatch.mockClear();
      const { result } = renderHook(() =>
        useGameCardActions("skyrimse", "managed", () => {}, source, undefined, store),
      );

      return { manage, primary: result.current.primary };
    };

    it("is recorded before a detected game's add runs, so discovery can be held to it", () => {
      const { manage, primary } = leadWith("detected_list", "steam");

      primary?.onClick();

      expect(dispatch).toHaveBeenCalledWith(setGameAddStore(VortexGameId("skyrimse"), "steam"));
      expect(dispatch.mock.invocationCallOrder.at(-1)).toBeLessThan(
        manage.mock.invocationCallOrder[0],
      );
    });

    it("is not recorded when the tile names none", () => {
      const { primary } = leadWith("detected_list", undefined);

      primary?.onClick();

      expect(dispatch).toHaveBeenCalledWith(setGameAddOrigin("skyrimse", "detected_list"));
      expect(dispatched(setGameAddStore)).toEqual([]);
    });

    it("is not recorded for a game added from the list of every supported game", () => {
      const { primary } = leadWith("all_games", "steam");

      primary?.onClick();

      expect(dispatch).toHaveBeenCalledWith(setGameAddOrigin("skyrimse", "all_games"));
      expect(dispatched(setGameAddStore)).toEqual([]);
    });
  });

  describe("the extension a tile carries", () => {
    const emberville = {
      name: "Emberville",
      modId: 1,
      fileId: 1,
      author: "tester",
      version: "1.0.0",
      timestamp: 0,
    };

    const leadWith = (extension: IAvailableExtension | undefined) => {
      objects.current = [
        definition({ title: "Manage", position: 50, icon: "activate", action: vi.fn() }),
      ];
      dispatch.mockClear();
      const { result } = renderHook(() =>
        useGameCardActions(
          "skyrimse",
          "managed",
          () => {},
          "all_games",
          undefined,
          undefined,
          extension,
        ),
      );

      return result.current.primary;
    };

    it("is recorded before the add runs, so it can be offered", () => {
      leadWith(emberville)?.onClick();

      expect(dispatch).toHaveBeenCalledWith(setGameAddExtension(emberville));
    });

    it("is recorded after the pick of an earlier tile is forgotten", () => {
      leadWith(emberville)?.onClick();

      const kinds = dispatch.mock.calls.map(([action]) => action.type);
      expect(kinds.indexOf(clearGameAddStore.getType())).toBeLessThan(
        kinds.indexOf(setGameAddExtension.getType()),
      );
    });

    it("is cleared by a click on a tile that carries none, so an earlier tile's isn't offered", () => {
      leadWith(undefined)?.onClick();

      expect(dispatch).toHaveBeenCalledWith(setGameAddExtension(null));
    });
  });
});
