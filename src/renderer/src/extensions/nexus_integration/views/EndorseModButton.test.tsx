import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TFunction } from "i18next";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { EndorseModButton } from "./EndorseModButton";

const t = ((key: string) => key) as unknown as TFunction;

const renderButton = (endorsedStatus: string, onEndorseMod = vi.fn()) => {
  const button = (status: string) => (
    <EndorseModButton
      endorsedStatus={status}
      gameId="skyrimse"
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

describe("EndorseModButton", () => {
  it("endorses with the status it shows", async () => {
    const { onEndorseMod } = renderButton("Undecided");

    await userEvent.click(screen.getByTestId("endorse-button"));

    expect(onEndorseMod).toHaveBeenCalledWith("skyrimse", "mod-1", "Undecided");
  });

  it("fills the thumb for an endorsed mod, without a burst for one endorsed before it's shown", () => {
    renderButton("Endorsed");

    expect(isThumbFilled()).toBe(true);
    expect(screen.queryByTestId("endorse-burst")).toBeNull();
  });

  it("fills the thumb and bursts as soon as Nexus is asked to endorse, until the pop ends", () => {
    const { setStatus } = renderButton("Undecided");
    expect(isThumbFilled()).toBe(false);

    setStatus("pending");
    expect(isThumbFilled()).toBe(true);
    expect(screen.getByTestId("endorse-burst")).toBeInTheDocument();

    setStatus("Endorsed");
    expect(screen.getByTestId("endorse-burst")).toBeInTheDocument();

    fireEvent.animationEnd(screen.getByTestId("endorse-thumb"));
    expect(screen.queryByTestId("endorse-burst")).toBeNull();
    expect(isThumbFilled()).toBe(true);
  });

  it("bursts when a mod becomes endorsed without a pending answer", () => {
    const { setStatus } = renderButton("Undecided");

    setStatus("Endorsed");

    expect(screen.getByTestId("endorse-burst")).toBeInTheDocument();
  });

  it("empties the thumb and stops the burst if Nexus turns the endorsement down", () => {
    const { setStatus } = renderButton("Undecided");

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

  it("asks nothing more while Nexus answers", async () => {
    const { onEndorseMod, setStatus } = renderButton("Undecided");

    setStatus("pending");
    await userEvent.click(screen.getByTestId("endorse-button"));

    expect(onEndorseMod).not.toHaveBeenCalled();
  });

  it("shows a spinner when it's drawn while Nexus is asked", () => {
    renderButton("pending");

    expect(screen.getByTestId("endorse-button")).toBeDisabled();
  });

  it.each(["Disabled", "Blocked"])("can't be pressed when %s", async (status) => {
    const { onEndorseMod } = renderButton(status);

    await userEvent.click(screen.getByTestId("endorse-button"));

    expect(screen.getByTestId("endorse-button")).toHaveAttribute("aria-disabled", "true");
    expect(onEndorseMod).not.toHaveBeenCalled();
  });
});
