import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { EndorseButton, type IEndorseButtonProps } from "./EndorseButton";

const renderButton = (props: Partial<IEndorseButtonProps> = {}) => {
  const onClick = vi.fn();
  const button = (next: Partial<IEndorseButtonProps>) => (
    <EndorseButton isEndorsed={false} label="Endorse" onClick={onClick} {...next} />
  );
  const { rerender } = render(button(props));
  return { onClick, setProps: (next: Partial<IEndorseButtonProps>) => rerender(button(next)) };
};

const getButton = () => screen.getByTestId("endorse-button");

const isThumbFilled = () =>
  screen.getByTestId("endorse-thumb").style.fontVariationSettings === '"FILL" 1';

const hasBurst = () => screen.queryByTestId("endorse-burst") !== null;

describe("EndorseButton", () => {
  it("is a toggle, pressed with its thumb filled once endorsed", () => {
    const { setProps } = renderButton();
    expect(getButton()).toHaveAttribute("aria-pressed", "false");
    expect(isThumbFilled()).toBe(false);

    setProps({ isEndorsed: true });

    expect(getButton()).toHaveAttribute("aria-pressed", "true");
    expect(isThumbFilled()).toBe(true);
  });

  it("bursts when it becomes endorsed while pending, until the pop ends", () => {
    const { setProps } = renderButton();

    setProps({ isEndorsed: true, isPending: true });
    expect(hasBurst()).toBe(true);

    setProps({ isEndorsed: true });
    expect(hasBurst()).toBe(true);

    fireEvent.animationEnd(screen.getByTestId("endorse-thumb"));
    expect(hasBurst()).toBe(false);
  });

  it("stops the burst if the pop is cancelled", () => {
    const { setProps } = renderButton();
    setProps({ isEndorsed: true, isPending: true });

    fireEvent(screen.getByTestId("endorse-thumb"), new Event("animationcancel", { bubbles: true }));

    expect(hasBurst()).toBe(false);
  });

  it("stops the burst if it's no longer endorsed", () => {
    const { setProps } = renderButton();
    setProps({ isEndorsed: true, isPending: true });

    setProps({ isEndorsed: false });

    expect(hasBurst()).toBe(false);
  });

  it("doesn't burst when it becomes endorsed without a pending request, as on a refresh", () => {
    const { setProps } = renderButton();

    setProps({ isEndorsed: true });

    expect(isThumbFilled()).toBe(true);
    expect(hasBurst()).toBe(false);
  });

  it("doesn't burst when it's drawn endorsed", () => {
    renderButton({ isEndorsed: true });

    expect(hasBurst()).toBe(false);
  });

  it("is busy and ignores clicks while pending", async () => {
    const { onClick } = renderButton({ isPending: true });

    await userEvent.click(getButton());

    expect(getButton()).toHaveAttribute("aria-busy", "true");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("shows a spinner in place of the thumb, and can't be pressed, while loading", () => {
    renderButton({ isLoading: true });

    expect(getButton()).toBeDisabled();
    expect(screen.queryByTestId("endorse-thumb")).toBeNull();
  });

  it("can't be pressed with a disabled reason, which describes it", async () => {
    const { onClick } = renderButton({ disabledReason: "Turned off" });

    await userEvent.click(getButton());

    expect(getButton()).toHaveAttribute("aria-disabled", "true");
    expect(getButton()).toHaveAttribute("aria-description");
    expect(onClick).not.toHaveBeenCalled();
  });
});
