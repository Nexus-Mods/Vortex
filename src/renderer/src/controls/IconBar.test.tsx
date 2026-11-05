/**
 * Tests for IconBar's `onAction`: a caller can hear which registered action ran, by
 * its definition, without the action itself changing.
 */
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import type { IActionDefinition } from "../types/IActionDefinition";

// ActionControl collects a group's registrations through the extension provider; this
// stand-in hands its child the static ones instead, as resolved actions.
vi.mock("./ActionControl", () => ({
  default: ({
    children,
    instanceId,
    staticElements,
  }: {
    children: React.ReactElement;
    instanceId: string;
    staticElements: IActionDefinition[];
  }) =>
    React.cloneElement(children, {
      instanceId,
      // as ActionControl does with showAll: a condition that rules the action out disables it
      actions: staticElements.map((action) => ({
        ...action,
        show: action.condition?.([instanceId]) ?? true,
      })),
    } as object),
}));

import IconBar from "./IconBar";

const manage = (action = vi.fn()): IActionDefinition => ({
  title: "Manage",
  icon: "activate",
  position: 50,
  action,
});

const renderBar = (definition: IActionDefinition, onAction?: (a: IActionDefinition) => void) =>
  render(
    <IconBar
      buttonType="text"
      group="game-unmanaged-buttons"
      instanceId="skyrimse"
      staticElements={[definition]}
      t={((input: string) => input) as never}
      onAction={onAction}
    />,
  );

describe("IconBar", () => {
  it("tells onAction which action ran, then runs it", async () => {
    const action = vi.fn();
    const onAction = vi.fn();
    const { container } = renderBar(manage(action), onAction);

    await userEvent.click(container.querySelector(".action-manage") as HTMLElement);

    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ title: "Manage" }), 0);
    expect(action).toHaveBeenCalledWith(["skyrimse"], undefined);
  });

  it("tells onAction where in the bar the action sits", async () => {
    const onAction = vi.fn();
    const { container } = render(
      <IconBar
        buttonType="text"
        group="game-unmanaged-buttons"
        instanceId="skyrimse"
        staticElements={[manage(), { title: "Install Extension", position: 60, action: vi.fn() }]}
        t={((input: string) => input) as never}
        onAction={onAction}
      />,
    );

    await userEvent.click(container.querySelector(".action-install-extension") as HTMLElement);

    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Install Extension" }),
      1,
    );
  });

  // clickAnywhere runs a bar's only action from a click on the bar itself, even one its
  // condition disabled; nothing ran that the user chose, so nothing is reported.
  it("doesn't tell onAction about a disabled action a background click ran", async () => {
    const action = vi.fn();
    const onAction = vi.fn();
    const { container } = render(
      <IconBar
        buttonType="text"
        clickAnywhere={true}
        group="game-managed-buttons"
        instanceId="skyrimse"
        staticElements={[{ ...manage(action), condition: () => false }]}
        t={((input: string) => input) as never}
        onAction={onAction}
      />,
    );

    await userEvent.click(container.firstElementChild as HTMLElement);

    expect(action).toHaveBeenCalled();
    expect(onAction).not.toHaveBeenCalled();
  });

  it("runs the action as before without onAction", async () => {
    const action = vi.fn();
    const { container } = renderBar(manage(action));

    await userEvent.click(container.querySelector(".action-manage") as HTMLElement);

    expect(action).toHaveBeenCalledWith(["skyrimse"], undefined);
  });
});
