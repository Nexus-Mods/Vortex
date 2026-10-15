import { RadioGroup } from "@headlessui/react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { createRef } from "react";
import { describe, it, expect, vi } from "vitest";

import { Radio } from "./Radio";

const renderRadios = (onChange = vi.fn(), value = "a") =>
  render(
    <RadioGroup aria-label="Choice" value={value} onChange={onChange}>
      <Radio aria-label="A" className="my-class" value="a" />

      <Radio aria-label="B" value="b" />

      <Radio aria-label="C" disabled value="c" />
    </RadioGroup>,
  );

describe("Radio", () => {
  it("renders a radio with the base class, merging a custom one", () => {
    renderRadios();
    expect(screen.getByRole("radio", { name: "A" })).toHaveClass("nxm-radio", "my-class");
  });

  it("is checked when its value is the group's, for styling too", () => {
    renderRadios();
    expect(screen.getByRole("radio", { name: "A" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "A" })).toHaveAttribute("data-checked");
    expect(screen.getByRole("radio", { name: "B" })).not.toBeChecked();
  });

  it("hands the group its value when clicked", async () => {
    const onChange = vi.fn();
    renderRadios(onChange);

    await userEvent.click(screen.getByRole("radio", { name: "B" }));

    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("ignores clicks when disabled", async () => {
    const onChange = vi.fn();
    renderRadios(onChange);

    await userEvent.click(screen.getByRole("radio", { name: "C" }));

    expect(screen.getByRole("radio", { name: "C" })).toHaveAttribute("data-disabled");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("forwards its ref to the radio", () => {
    const ref = createRef<HTMLSpanElement>();
    render(
      <RadioGroup aria-label="Choice" value="a" onChange={() => undefined}>
        <Radio aria-label="A" ref={ref} value="a" />
      </RadioGroup>,
    );
    expect(ref.current).toBe(screen.getByRole("radio"));
  });
});
