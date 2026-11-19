import { render } from "@testing-library/react";
import React, { createRef } from "react";
import { describe, expect, it } from "vitest";

import ToolbarIcon from "./ToolbarIcon";

describe("ToolbarIcon", () => {
  it("hands its button element to domRef", () => {
    const domRef = createRef<HTMLButtonElement>();
    const { getByRole } = render(<ToolbarIcon tooltip="Manage" text="Manage" domRef={domRef} />);

    expect(domRef.current).toBe(getByRole("button"));
  });

  it("renders the same button without a domRef", () => {
    const { getByRole } = render(<ToolbarIcon tooltip="Manage" text="Manage" className="manage" />);

    expect(getByRole("button")).toHaveClass("manage");
  });
});
