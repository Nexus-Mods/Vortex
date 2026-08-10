import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { Switch } from "./Switch";

const getSwitch = () => screen.getByRole("checkbox");

describe("Switch", () => {
  it("renders an unchecked checkbox by default", () => {
    render(<Switch aria-label="Setting" />);
    expect(getSwitch()).not.toBeChecked();
  });

  it("reflects the checked prop", () => {
    render(<Switch aria-label="Setting" checked={true} onChange={() => undefined} />);
    expect(getSwitch()).toBeChecked();
  });

  it("reports semi-on as partially checked (aria mixed)", () => {
    render(<Switch aria-label="Setting" indeterminate={true} onChange={() => undefined} />);
    expect(getSwitch()).toBePartiallyChecked();
  });

  // The reason this is built on Headless UI's Checkbox rather than its Switch:
  // ARIA only allows true/false on `role="switch"`, so semi-on needs a checkbox.
  it('exposes semi-on as role="checkbox" with aria-checked="mixed"', () => {
    render(<Switch aria-label="Setting" indeterminate={true} onChange={() => undefined} />);

    expect(getSwitch()).toHaveAttribute("role", "checkbox");
    expect(getSwitch()).toHaveAttribute("aria-checked", "mixed");
  });

  it("keeps semi-on even when checked is false, so a master control can show it", () => {
    render(
      <Switch
        aria-label="Setting"
        checked={false}
        indeterminate={true}
        onChange={() => undefined}
      />,
    );
    expect(getSwitch()).toBePartiallyChecked();
  });

  // The track styles itself off the attributes Headless UI sets, so those are
  // what the appearance of each state actually depends on.
  it("marks the track with the state attributes for off, on and semi-on", () => {
    const track = () => document.querySelector(".nxm-switch");

    const { rerender } = render(<Switch aria-label="Setting" checked={false} />);
    expect(track()).not.toHaveAttribute("data-checked");
    expect(track()).not.toHaveAttribute("data-indeterminate");

    rerender(<Switch aria-label="Setting" checked={true} />);
    expect(track()).toHaveAttribute("data-checked");
    expect(track()).not.toHaveAttribute("data-indeterminate");

    rerender(<Switch aria-label="Setting" indeterminate={true} />);
    expect(track()).toHaveAttribute("data-indeterminate");
  });

  it("calls onChange when clicked", async () => {
    const onChange = vi.fn();
    render(<Switch aria-label="Setting" checked={false} onChange={onChange} />);

    await userEvent.click(getSwitch());
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("does not call onChange when disabled", async () => {
    const onChange = vi.fn();
    render(<Switch aria-label="Setting" checked={false} disabled={true} onChange={onChange} />);

    await userEvent.click(getSwitch());
    expect(onChange).not.toHaveBeenCalled();
  });
});
