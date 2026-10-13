import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { PlainText } from "./PlainText";

describe("PlainText", () => {
  it("renders the text as written, in the app's prose styles, its line breaks kept", () => {
    render(<PlainText text={"# Fixed *things*\nAdded more"} />);

    const text = screen.getByText(/# Fixed \*things\*\s+Added more/);
    expect(text).toHaveClass("nxm-prose", "whitespace-pre-line");
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("comes in the body text's size, or smaller", () => {
    const { container, rerender } = render(<PlainText text="Hi" />);
    expect(container.firstElementChild).not.toHaveClass("nxm-prose-sm");

    rerender(<PlainText size="sm" text="Hi" />);
    expect(container.firstElementChild).toHaveClass("nxm-prose", "nxm-prose-sm");
  });

  it("takes classes to change its colour", () => {
    const { container } = render(<PlainText className="text-neutral-subdued" text="Hi" />);

    expect(container.firstElementChild).toHaveClass("nxm-prose", "text-neutral-subdued");
  });
});
