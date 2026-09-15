import { renderHook } from "@testing-library/react";
import type * as ReactReduxTypes from "react-redux";
import { describe, expect, it, vi } from "vitest";

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

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
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

import { useGameCardActions } from "./useGameCardActions.hook";

const definition = (over: Partial<IActionDefinition>): IActionDefinition =>
  ({
    title: "Action",
    position: 105,
    icon: "open-ext",
    action: vi.fn(),
    ...over,
  }) as IActionDefinition;

const actionsFor = (definitions: IActionDefinition[], showDetails = () => {}) => {
  objects.current = definitions;
  const { result } = renderHook(() => useGameCardActions("skyrimse", "managed", showDetails));

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

  it("says Show for a game that's already hidden", () => {
    hidden.current = true;

    expect(labels([])[0]).toBe("Show");

    hidden.current = false;
  });
});
