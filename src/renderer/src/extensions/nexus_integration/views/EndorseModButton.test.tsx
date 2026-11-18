import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VortexGameId } from "@vortex/shared";
import type { TFunction } from "i18next";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { EndorseModButton } from "./EndorseModButton";

const t = ((key: string) => key) as unknown as TFunction;

const GAME_ID = VortexGameId("skyrimse");

const renderButton = (endorsedStatus: string, onEndorseMod = vi.fn()) => {
  const button = (status: string) => (
    <EndorseModButton
      endorsedStatus={status}
      gameId={GAME_ID}
      modId="mod-1"
      t={t}
      onEndorseMod={onEndorseMod}
    />
  );
  const { rerender } = render(button(endorsedStatus));
  return { onEndorseMod, setStatus: (status: string) => rerender(button(status)) };
};

const isThumbFilled = () =>
  screen.getByTestId("endorse-thumb").style.fontVariationSettings === '"FILL" 1';

const clickButton = () => userEvent.click(screen.getByTestId("endorse-button"));

describe("EndorseModButton", () => {
  it("endorses with the status it shows", async () => {
    const { onEndorseMod } = renderButton("Undecided");

    await clickButton();

    expect(onEndorseMod).toHaveBeenCalledWith(GAME_ID, "mod-1", "Undecided");
  });

  it("is a toggle named for its action, pressed once endorsed", () => {
    const { setStatus } = renderButton("Undecided");
    const button = screen.getByRole("button", { name: "Endorse" });
    expect(button).toHaveAttribute("aria-pressed", "false");

    setStatus("Endorsed");

    expect(screen.getByRole("button", { name: "Endorse" })).toBe(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("fills the thumb for an endorsed mod, without a burst for one endorsed before it's shown", () => {
    renderButton("Endorsed");

    expect(isThumbFilled()).toBe(true);
    expect(screen.queryByTestId("endorse-burst")).toBeNull();
  });

  it("fills the thumb and bursts as soon as Nexus is asked to endorse, until the pop ends", async () => {
    const { setStatus } = renderButton("Undecided");
    expect(isThumbFilled()).toBe(false);

    await clickButton();
    setStatus("pending");
    expect(isThumbFilled()).toBe(true);
    expect(screen.getByTestId("endorse-burst")).toBeInTheDocument();

    setStatus("Endorsed");
    expect(screen.getByTestId("endorse-burst")).toBeInTheDocument();

    fireEvent.animationEnd(screen.getByTestId("endorse-thumb"));
    expect(screen.queryByTestId("endorse-burst")).toBeNull();
    expect(isThumbFilled()).toBe(true);
  });

  it("bursts when a click endorses without a pending answer", async () => {
    const { setStatus } = renderButton("Undecided");

    await clickButton();
    setStatus("Endorsed");

    expect(screen.getByTestId("endorse-burst")).toBeInTheDocument();
  });

  it("fills the thumb without a burst when a refresh from Nexus endorses it", () => {
    const { setStatus } = renderButton("Undecided");

    setStatus("Endorsed");

    expect(isThumbFilled()).toBe(true);
    expect(screen.queryByTestId("endorse-burst")).toBeNull();
  });

  it("empties the thumb and stops the burst if Nexus turns the endorsement down", async () => {
    const { setStatus } = renderButton("Undecided");

    await clickButton();
    setStatus("pending");
    setStatus("Undecided");

    expect(isThumbFilled()).toBe(false);
    expect(screen.queryByTestId("endorse-burst")).toBeNull();
  });

  it("empties the thumb without a burst while a withdrawal is asked", () => {
    const { setStatus } = renderButton("Endorsed");

    setStatus("pending");

    expect(isThumbFilled()).toBe(false);
    expect(screen.queryByTestId("endorse-burst")).toBeNull();
  });

  it("is busy and asks nothing more while Nexus answers", async () => {
    const { onEndorseMod, setStatus } = renderButton("Undecided");

    setStatus("pending");
    await clickButton();

    expect(screen.getByTestId("endorse-button")).toHaveAttribute("aria-busy", "true");
    expect(onEndorseMod).not.toHaveBeenCalled();
  });

  it("shows a spinner, not a side, when it's drawn while Nexus is asked", () => {
    renderButton("pending");

    const button = screen.getByTestId("endorse-button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByTestId("endorse-thumb")).toBeNull();
  });

  it.each(["Disabled", "Blocked"])("can't be pressed when %s", async (status) => {
    const { onEndorseMod } = renderButton(status);

    await clickButton();

    expect(screen.getByTestId("endorse-button")).toHaveAttribute("aria-disabled", "true");
    expect(onEndorseMod).not.toHaveBeenCalled();
  });

  it("only shows the answer, and says where to endorse, without a handler", async () => {
    render(<EndorseModButton endorsedStatus="Endorsed" gameId={GAME_ID} modId="mod-1" t={t} />);

    await clickButton();

    expect(screen.getByTestId("endorse-button")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("endorse-button")).toHaveAccessibleDescription(
      "Endorse a collection from its page",
    );
    expect(isThumbFilled()).toBe(true);
  });
});
