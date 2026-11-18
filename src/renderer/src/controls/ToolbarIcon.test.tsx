import { render } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it } from "vitest";

import ToolbarIcon from "./ToolbarIcon";

describe("ToolbarIcon", () => {
  it("hands its button element to buttonRef", () => {
    const buttonRef = React.createRef<HTMLButtonElement>();
    const { getByRole } = render(
      <ToolbarIcon tooltip="Manage" text="Manage" buttonRef={buttonRef} />,
    );

    expect(buttonRef.current).toBe(getByRole("button"));
  });

  it("renders the same button without a buttonRef", () => {
    const { getByRole } = render(<ToolbarIcon tooltip="Manage" text="Manage" className="manage" />);

    expect(getByRole("button")).toHaveClass("manage");
  });
});
