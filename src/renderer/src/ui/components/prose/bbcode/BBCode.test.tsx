import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { BBCode } from "./BBCode";

describe("BBCode", () => {
  it("renders the tags in the app's prose styles", () => {
    const { container } = render(<BBCode bbcode="A [b]bold[/b] and [i]slanted[/i] word" />);

    expect(container.firstElementChild).toHaveClass("nxm-prose");
    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.getByText("slanted").tagName).toBe("EM");
  });

  it("takes classes to change its colour", () => {
    const { container } = render(<BBCode bbcode="Hi" className="text-neutral-subdued" />);

    expect(container.firstElementChild).toHaveClass("nxm-prose", "text-neutral-subdued");
  });

  it("comes in the body text's size, or smaller", () => {
    const { container, rerender } = render(<BBCode bbcode="Hi" />);
    expect(container.firstElementChild).not.toHaveClass("nxm-prose-sm");

    rerender(<BBCode bbcode="Hi" size="sm" />);
    expect(container.firstElementChild).toHaveClass("nxm-prose", "nxm-prose-sm");
  });
});
