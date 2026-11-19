import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { makeExtensionReactMarkdown, ReactMarkdown } from "./ReactMarkdown";

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

  it.each([
    ["an app's protocol", "steam://run/489830"],
    ["a relative path", "../run.exe"],
    ["a network path", "//server/share/run.exe"],
  ])("leaves a link to %s with no target, so clicking it does nothing", (_, href) => {
    render(<ReactMarkdown>{`[Launch](${href})`}</ReactMarkdown>);

    expect(screen.getByText("Launch").closest("a")).not.toHaveAttribute("href");
  });

  it("keeps an image's source as react-markdown 6 did", () => {
    render(<ReactMarkdown>{"![icon](data:image/png;base64,AAAA)"}</ReactMarkdown>);

    expect(screen.getByRole("img", { name: "icon" })).toHaveAttribute(
      "src",
      "data:image/png;base64,AAAA",
    );
  });
});

describe("makeExtensionReactMarkdown", () => {
  it("is the component, and its own default, as react-markdown 6 was to an extension", () => {
    const ExtensionReactMarkdown = makeExtensionReactMarkdown(() => undefined);

    expect(ExtensionReactMarkdown.default).toBe(ExtensionReactMarkdown);
    render(<ExtensionReactMarkdown>{"Some **bold** text"}</ExtensionReactMarkdown>);
    expect(screen.getByText("bold").tagName).toBe("STRONG");
  });

  it("drops a prop only react-markdown 6 took and reports it", () => {
    const report = vi.fn();
    const ExtensionReactMarkdown = makeExtensionReactMarkdown(report);

    render(
      <ExtensionReactMarkdown {...{ linkTarget: "_blank" }}>
        {"[a link](https://example.com)"}
      </ExtensionReactMarkdown>,
    );

    expect(screen.getByRole("link", { name: "a link" })).not.toHaveAttribute("target");
    expect(report).toHaveBeenCalledWith("react-markdown.linkTarget", "components.a");
  });
});
