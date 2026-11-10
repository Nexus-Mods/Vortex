import { render, screen } from "@testing-library/react";
import React from "react";
import ReactMarkdown from "react-markdown";
import { describe, expect, it } from "vitest";

import { WebLink } from "./WebLink";

const renderMarkdown = (markdown: string) =>
  render(<ReactMarkdown components={{ a: WebLink }}>{markdown}</ReactMarkdown>);

describe("WebLink", () => {
  it("keeps a link to a web page", () => {
    renderMarkdown("[the page](https://example.com/page)");

    expect(screen.getByRole("link", { name: "the page" })).toHaveAttribute(
      "href",
      "https://example.com/page",
    );
  });

  it("keeps a link to an email address", () => {
    renderMarkdown("[contact me](mailto:curator@example.com)");

    expect(screen.getByRole("link", { name: "contact me" })).toHaveAttribute(
      "href",
      "mailto:curator@example.com",
    );
  });

  it.each([
    ["a file", "file:///C:/run.exe"],
    ["an app", "steam://run/1"],
    ["a network path", "//server/share/run.exe"],
    ["a Windows network path", "\\\\server\\share\\run.exe"],
    ["a relative path", "../../../Users/Public/run.exe"],
    ["a rooted path", "/C:/Windows/System32/calc.exe"],
  ])("leaves %s as text, as it would resolve to a local file", (_name, target) => {
    renderMarkdown(`[open it](${target})`);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("open it").closest("a")).not.toHaveAttribute("href");
  });
});
