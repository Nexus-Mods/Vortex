import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { Markdown } from "./Markdown";

describe("Markdown", () => {
  it("renders the markdown in the app's prose styles", () => {
    const { container } = render(
      <Markdown
        markdown={"# Changes\n\n* Fixed **things**\n* See [the page](https://example.com)"}
      />,
    );

    expect(container.firstElementChild).toHaveClass("nxm-prose");
    expect(screen.getByRole("heading", { name: "Changes" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("things").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "the page" })).toHaveAttribute(
      "href",
      "https://example.com",
    );
  });

  it("takes classes to change its size or colour", () => {
    const { container } = render(<Markdown className="text-neutral-subdued" markdown="Hi" />);

    expect(container.firstElementChild).toHaveClass("nxm-prose", "text-neutral-subdued");
  });
});
