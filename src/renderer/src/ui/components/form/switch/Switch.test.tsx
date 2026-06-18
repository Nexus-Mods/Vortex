import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { Switch } from "./Switch";

afterEach(() => {
  cleanup();
});

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

  it("marks the track with the matching data-state", () => {
    const { rerender } = render(<Switch aria-label="Setting" checked={false} />);
    expect(document.querySelector(".nxm-switch")).toHaveAttribute("data-state", "off");

    rerender(<Switch aria-label="Setting" checked={true} />);
    expect(document.querySelector(".nxm-switch")).toHaveAttribute("data-state", "on");

    rerender(<Switch aria-label="Setting" indeterminate={true} />);
    expect(document.querySelector(".nxm-switch")).toHaveAttribute("data-state", "semi-on");
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
