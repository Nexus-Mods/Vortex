import { render, cleanup } from "@testing-library/react";
import React from "react";
import { describe, it, expect, afterEach } from "vitest";

import { Bullet } from "./Bullet";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const getBullet = () => document.querySelector(".nxm-bullet");

// --- Tests ---

describe("Bullet", () => {
  it("renders a div with the nxm-bullet class", () => {
    render(<Bullet />);
    const el = getBullet();
    expect(el).toBeInTheDocument();
    expect(el?.tagName).toBe("DIV");
  });

  it("merges a custom className with the base class", () => {
    render(<Bullet className="size-1 bg-neutral-subdued" />);
    expect(getBullet()).toHaveClass("nxm-bullet", "bg-neutral-subdued", "size-1");
  });
});
