import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { ReactMarkdown } from "./ReactMarkdown";

describe("ReactMarkdown", () => {
  it("renders markdown as HTML", () => {
    const { container } = render(
      <ReactMarkdown>{"Some **bold** text and [a link](https://example.com)"}</ReactMarkdown>,
    );

    expect(container.querySelector("strong")).not.toBeNull();
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
});
