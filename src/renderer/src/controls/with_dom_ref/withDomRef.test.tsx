import { render, screen } from "@testing-library/react";
import React, { createRef } from "react";
import { Button, MenuItem } from "react-bootstrap";
import { describe, expect, it } from "vitest";

import { withDomRef } from "./withDomRef";

const ButtonWithDomRef = withDomRef("button");
const AnchorWithDomRef = withDomRef("a");

describe("withDomRef", () => {
  it("hands the element it renders to domRef", () => {
    const domRef = createRef<HTMLButtonElement>();

    render(<ButtonWithDomRef domRef={domRef} title="Manage" />);

    expect(domRef.current).toBe(screen.getByRole("button", { name: "Manage" }));
  });

  // react-bootstrap 0.33 doesn't pass a ref on, but gives its componentClass the props it
  // doesn't use itself
  it("gets the element out of react-bootstrap's Button", () => {
    const domRef = createRef<HTMLButtonElement>();
    const props = { componentClass: ButtonWithDomRef, domRef };

    render(<Button {...props}>Manage</Button>);

    expect(domRef.current).toBe(screen.getByRole("button", { name: "Manage" }));
    expect(domRef.current).toHaveClass("btn");
  });

  it("gets the element out of react-bootstrap's MenuItem", () => {
    const domRef = createRef<HTMLAnchorElement>();
    const props = { componentClass: AnchorWithDomRef, domRef };

    render(<MenuItem {...props}>Open</MenuItem>);

    expect(domRef.current).toBe(screen.getByRole("menuitem", { name: "Open" }));
  });
});
