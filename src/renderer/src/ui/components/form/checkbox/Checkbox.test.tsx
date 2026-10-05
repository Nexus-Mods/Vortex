import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { createRef } from "react";
import { describe, it, expect, vi } from "vitest";

import { Checkbox } from "./Checkbox";

const getCheckbox = () => screen.getByRole("checkbox");

describe("Checkbox", () => {
  it("renders an unchecked checkbox with the base class, merging a custom one", () => {
    render(<Checkbox aria-label="Accept" className="my-class" />);
    expect(getCheckbox()).not.toBeChecked();
    expect(getCheckbox()).toHaveClass("nxm-checkbox", "my-class");
  });

  it("reflects the checked prop, for styling too", () => {
    render(<Checkbox checked aria-label="Accept" onChange={() => undefined} />);
    expect(getCheckbox()).toBeChecked();
    expect(getCheckbox()).toHaveAttribute("data-checked");
  });

  it("reports indeterminate as aria-checked mixed", () => {
    render(<Checkbox indeterminate aria-label="Accept" onChange={() => undefined} />);
    expect(getCheckbox()).toBePartiallyChecked();
    expect(getCheckbox()).toHaveAttribute("data-indeterminate");
  });

  it("hands onChange the new checked value", async () => {
    const onChange = vi.fn();
    render(<Checkbox aria-label="Accept" checked={false} onChange={onChange} />);

    await userEvent.click(getCheckbox());

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("ignores clicks when disabled", async () => {
    const onChange = vi.fn();
    render(<Checkbox disabled aria-label="Accept" onChange={onChange} />);

    await userEvent.click(getCheckbox());

    expect(getCheckbox()).toHaveAttribute("data-disabled");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports invalid as aria-invalid and data-invalid", () => {
    render(<Checkbox invalid aria-label="Accept" />);
    expect(getCheckbox()).toHaveAttribute("aria-invalid", "true");
    expect(getCheckbox()).toHaveAttribute("data-invalid");
  });

  it("takes part in form submission when given a name", () => {
    render(
      <form>
        <Checkbox checked aria-label="Accept" name="terms" value="yes" onChange={() => undefined} />
      </form>,
    );
    const hidden = document.querySelector('input[name="terms"]');
    expect(hidden).toBeChecked();
    expect(hidden).toHaveAttribute("value", "yes");
  });

  it("forwards its ref to the checkbox", () => {
    const ref = createRef<HTMLSpanElement>();
    render(<Checkbox aria-label="Accept" ref={ref} />);
    expect(ref.current).toBe(getCheckbox());
  });
});
