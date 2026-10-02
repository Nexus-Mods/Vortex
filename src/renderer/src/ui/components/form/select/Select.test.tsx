import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { createRef } from "react";
import { describe, it, expect, vi } from "vitest";

import { Select } from "./Select";

const options = (
  <>
    <option value="a">Apple</option>
    <option value="b">Banana</option>
  </>
);

const getSelect = () => screen.getByRole("combobox");

describe("Select", () => {
  it("renders a native select with the base class, merging a custom one", () => {
    render(
      <Select aria-label="Fruit" className="my-class">
        {options}
      </Select>,
    );
    expect(getSelect().tagName).toBe("SELECT");
    expect(getSelect()).toHaveClass("nxm-select", "my-class");
    expect(screen.getByRole("option", { name: "Apple" })).toBeInTheDocument();
  });

  it("draws its chevron after the select", () => {
    render(<Select aria-label="Fruit">{options}</Select>);
    expect(getSelect().nextElementSibling).toHaveClass("nxm-select-icon");
  });

  it("passes the change event through", async () => {
    const onChange = vi.fn();
    render(
      <Select aria-label="Fruit" onChange={onChange}>
        {options}
      </Select>,
    );

    await userEvent.selectOptions(getSelect(), "b");

    expect(onChange.mock.calls[0][0].target.value).toBe("b");
  });

  it("reflects a controlled value", () => {
    render(
      <Select aria-label="Fruit" value="b" onChange={() => undefined}>
        {options}
      </Select>,
    );
    expect(getSelect()).toHaveValue("b");
  });

  it("reports invalid as aria-invalid and data-invalid", () => {
    render(
      <Select invalid aria-label="Fruit">
        {options}
      </Select>,
    );
    expect(getSelect()).toHaveAttribute("aria-invalid", "true");
    expect(getSelect()).toHaveAttribute("data-invalid");
  });

  it("marks itself disabled for styling", () => {
    render(
      <Select disabled aria-label="Fruit">
        {options}
      </Select>,
    );
    expect(getSelect()).toBeDisabled();
    expect(getSelect()).toHaveAttribute("data-disabled");
  });

  it("forwards its ref to the select", () => {
    const ref = createRef<HTMLSelectElement>();
    render(
      <Select aria-label="Fruit" ref={ref}>
        {options}
      </Select>,
    );
    expect(ref.current).toBe(getSelect());
  });
});
