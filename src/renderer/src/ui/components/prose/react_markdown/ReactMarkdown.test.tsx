import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { ReactMarkdown } from "./ReactMarkdown";

describe("ReactMarkdown", () => {
  it("renders markdown as HTML", () => {
    render(<ReactMarkdown>{"Some **bold** text and [a link](https://example.com)"}</ReactMarkdown>);

    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "a link" })).toHaveAttribute(
      "href",
      "https://example.com",
    );
  });

  it("wraps the markdown in a div with the class it's given", () => {
    const { container } = render(
      <ReactMarkdown className="changelog-text">{"text"}</ReactMarkdown>,
    );

    expect(container.firstElementChild).toHaveClass("changelog-text");
    expect(container.firstElementChild?.tagName).toBe("DIV");
  });

  it("renders nothing when it has no markdown", () => {
    const { container } = render(<ReactMarkdown>{undefined}</ReactMarkdown>);

    expect(container).toBeEmptyDOMElement();
  });
});
