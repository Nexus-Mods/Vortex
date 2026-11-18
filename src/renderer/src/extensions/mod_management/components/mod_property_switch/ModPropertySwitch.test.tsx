import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { ModPropertySwitch } from "./ModPropertySwitch";

describe("ModPropertySwitch", () => {
  it("turns on and off", async () => {
    const onChange = vi.fn();
    render(
      <ModPropertySwitch
        property={{
          kind: "switch",
          id: "iniTweak:Dark.ini",
          label: "Dark.ini",
          checked: false,
          onChange,
        }}
      />,
    );

    const toggle = screen.getByRole("checkbox");
    expect(toggle).not.toBeChecked();
    await userEvent.click(toggle);

    expect(onChange).toHaveBeenCalledWith(true);
  });
});
