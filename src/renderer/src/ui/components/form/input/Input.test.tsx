import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { createRef } from "react";
import { describe, it, expect, vi } from "vitest";

import { Input } from "./Input";

const getInput = () => screen.getByRole("textbox");

describe("Input", () => {
  it("renders a text input with the base class, merging a custom one", () => {
    render(<Input aria-label="Name" className="my-class" />);
    expect(getInput()).toHaveAttribute("type", "text");
    expect(getInput()).toHaveClass("nxm-input", "my-class");
  });

  it("passes the change event through", async () => {
    const onChange = vi.fn();
    render(<Input aria-label="Name" onChange={onChange} />);

    await userEvent.type(getInput(), "a");

    expect(onChange.mock.calls[0][0].target.value).toBe("a");
  });

  it("reports invalid as aria-invalid and data-invalid", () => {
    render(<Input invalid aria-label="Name" />);
    expect(getInput()).toHaveAttribute("aria-invalid", "true");
    expect(getInput()).toHaveAttribute("data-invalid");
  });

  it("marks itself disabled for styling", () => {
    render(<Input disabled aria-label="Name" />);
    expect(getInput()).toBeDisabled();
    expect(getInput()).toHaveAttribute("data-disabled");
  });

  it("forwards its ref to the input", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input aria-label="Name" ref={ref} />);
    expect(ref.current).toBe(getInput());
  });
});
