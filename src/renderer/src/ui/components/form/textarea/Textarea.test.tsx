import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { createRef } from "react";
import { describe, it, expect, vi } from "vitest";

import { Textarea } from "./Textarea";

const getTextarea = () => screen.getByRole("textbox");

describe("Textarea", () => {
  it("renders a text area with the input classes, merging a custom one", () => {
    render(<Textarea aria-label="Notes" className="my-class" />);
    expect(getTextarea().tagName).toBe("TEXTAREA");
    expect(getTextarea()).toHaveClass("nxm-input", "nxm-textarea", "my-class");
  });

  it("keeps line breaks and passes the change event through", async () => {
    const onChange = vi.fn();
    render(<Textarea aria-label="Notes" onChange={onChange} />);

    await userEvent.type(getTextarea(), "one{Enter}two");

    expect(getTextarea()).toHaveValue("one\ntwo");
    expect(onChange).toHaveBeenCalled();
  });

  it("reports invalid as aria-invalid and data-invalid", () => {
    render(<Textarea invalid aria-label="Notes" />);
    expect(getTextarea()).toHaveAttribute("aria-invalid", "true");
    expect(getTextarea()).toHaveAttribute("data-invalid");
  });

  it("marks itself disabled for styling", () => {
    render(<Textarea disabled aria-label="Notes" />);
    expect(getTextarea()).toBeDisabled();
    expect(getTextarea()).toHaveAttribute("data-disabled");
  });

  it("forwards its ref to the text area", () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea aria-label="Notes" ref={ref} />);
    expect(ref.current).toBe(getTextarea());
  });
});
