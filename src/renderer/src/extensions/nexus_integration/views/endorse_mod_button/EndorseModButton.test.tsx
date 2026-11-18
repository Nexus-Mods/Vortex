import { render, screen } from "@testing-library/react";
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

const getButton = () => screen.getByTestId("endorse-button");

const isThumbFilled = () =>
  screen.getByTestId("endorse-thumb").style.fontVariationSettings === '"FILL" 1';

const hasBurst = () => screen.queryByTestId("endorse-burst") !== null;

describe("EndorseModButton", () => {
  it("endorses with the status it shows", async () => {
    const { onEndorseMod } = renderButton("Undecided");

    await userEvent.click(getButton());

    expect(onEndorseMod).toHaveBeenCalledWith(GAME_ID, "mod-1", "Undecided");
  });

  it("fills the thumb and bursts as soon as Nexus is asked to endorse", () => {
    const { setStatus } = renderButton("Undecided");

    setStatus("pending");
    expect(isThumbFilled()).toBe(true);
    expect(hasBurst()).toBe(true);
    expect(getButton()).toHaveAttribute("aria-busy", "true");

    setStatus("Endorsed");
    expect(isThumbFilled()).toBe(true);
  });

  it("empties the thumb if Nexus turns the endorsement down", () => {
    const { setStatus } = renderButton("Undecided");

    setStatus("pending");
    setStatus("Undecided");

    expect(isThumbFilled()).toBe(false);
    expect(hasBurst()).toBe(false);
  });

  it("empties the thumb without a burst while a withdrawal is asked", () => {
    const { setStatus } = renderButton("Endorsed");

    setStatus("pending");

    expect(isThumbFilled()).toBe(false);
    expect(hasBurst()).toBe(false);
  });

  it("fills the thumb without a burst when a refresh from Nexus endorses it", () => {
    const { setStatus } = renderButton("Undecided");

    setStatus("Endorsed");

    expect(isThumbFilled()).toBe(true);
    expect(hasBurst()).toBe(false);
  });

  it("shows a spinner, not a side, when it's drawn while Nexus is asked", () => {
    renderButton("pending");

    expect(getButton()).toBeDisabled();
    expect(getButton()).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByTestId("endorse-thumb")).toBeNull();
  });

  it.each(["Disabled", "Blocked"])("can't be pressed when %s", async (status) => {
    const { onEndorseMod } = renderButton(status);

    await userEvent.click(getButton());

    expect(getButton()).toHaveAttribute("aria-disabled", "true");
    expect(onEndorseMod).not.toHaveBeenCalled();
  });

  it("only shows the answer, with a reason, without a handler", async () => {
    render(<EndorseModButton endorsedStatus="Endorsed" gameId={GAME_ID} modId="mod-1" t={t} />);

    await userEvent.click(getButton());

    expect(getButton()).toHaveAttribute("aria-disabled", "true");
    expect(getButton()).toHaveAttribute("aria-description");
    expect(isThumbFilled()).toBe(true);
  });
});
