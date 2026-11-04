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
      actions: staticElements.map((action) => ({ ...action, show: true })),
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

    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ title: "Manage" }));
    expect(action).toHaveBeenCalledWith(["skyrimse"], undefined);
  });

  it("runs the action as before without onAction", async () => {
    const action = vi.fn();
    const { container } = renderBar(manage(action));

    await userEvent.click(container.querySelector(".action-manage") as HTMLElement);

    expect(action).toHaveBeenCalledWith(["skyrimse"], undefined);
  });
});
