import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { makeExtensionReactMarkdown, ReactMarkdown } from "./ReactMarkdown";

/** A link component that renders whatever href it's given, as an extension's own might. */
const PlainLink = ({ href, children }: { href?: string; children?: React.ReactNode }) => (
  <a href={href}>{children}</a>
);

describe("ReactMarkdown", () => {
  it("renders markdown as HTML", () => {
    const { container } = render(
      <ReactMarkdown>{"Some **bold** text and [a link](https://example.com)"}</ReactMarkdown>,
    );

    expect(container.querySelector("strong")).not.toBeNull();
    expect(screen.getByRole("link")).toHaveAttribute("href", "https://example.com");
  });

  it("wraps the markdown in a div with the class it's given", () => {
    const { container } = render(
      <ReactMarkdown className="changelog-text">{"text"}</ReactMarkdown>,
    );

    expect(container.firstElementChild).toHaveClass("changelog-text");
    expect(container.firstElementChild?.tagName).toBe("DIV");
  });

  describe.each([
    ["its own links", undefined],
    ["a caller's own link component", { a: PlainLink }],
  ])("with %s", (_, components) => {
    it.each([
      ["an app's protocol", "steam://run/489830"],
      ["a relative path", "../run.exe"],
      ["a network path", "//server/share/run.exe"],
      ["a phone number", "tel:123"],
    ])("leaves a link to %s with no target, so clicking it does nothing", (_, href) => {
      const { container } = render(
        <ReactMarkdown components={components}>{`[Launch](${href})`}</ReactMarkdown>,
      );

      expect(container.querySelector("a")).not.toHaveAttribute("href");
    });

    it("keeps a link to a web page", () => {
      render(
        <ReactMarkdown components={components}>{"[docs](https://example.com)"}</ReactMarkdown>,
      );

      expect(screen.getByRole("link")).toHaveAttribute("href", "https://example.com");
    });
  });

  it("filters what a caller's own urlTransform returns", () => {
    const { container } = render(
      <ReactMarkdown components={{ a: PlainLink }} urlTransform={(url) => url}>
        {"[Launch](steam://run/1)"}
      </ReactMarkdown>,
    );

    expect(container.querySelector("a")).not.toHaveAttribute("href");
  });

  it.each([
    ["held in the address", "data:image/png;base64,AAAA"],
    ["from the web", "https://example.com/icon.png"],
    ["from a file on this machine", "file:///C:/extension/icon.png"],
  ])("keeps the source of an image %s, as react-markdown 6 did", (_, src) => {
    render(<ReactMarkdown>{`![icon](${src})`}</ReactMarkdown>);

    expect(screen.getByRole("img")).toHaveAttribute("src", src);
  });

  it.each([
    ["a network path", "//attacker.example/share/x.png"],
    ["a file on a network share", "file://attacker.example/share/x.png"],
  ])("drops the source of an image from %s", (_, src) => {
    render(<ReactMarkdown>{`![icon](${src})`}</ReactMarkdown>);

    expect(screen.getByRole("img")).not.toHaveAttribute("src");
  });
});

describe("makeExtensionReactMarkdown", () => {
  it("is the component, and its own default, as react-markdown 6 was to an extension", () => {
    const ExtensionReactMarkdown = makeExtensionReactMarkdown(() => undefined);

    expect(ExtensionReactMarkdown.default).toBe(ExtensionReactMarkdown);
    const { container } = render(
      <ExtensionReactMarkdown>{"Some **bold** text"}</ExtensionReactMarkdown>,
    );
    expect(container.querySelector("strong")).not.toBeNull();
  });

  it("carries react-markdown 9's other exports, and 6's uriTransformer", () => {
    const report = vi.fn();
    const ExtensionReactMarkdown = makeExtensionReactMarkdown(report);

    expect(ExtensionReactMarkdown.defaultUrlTransform("steam://run/1")).toBe("");
    expect(ExtensionReactMarkdown.MarkdownHooks).toBeTypeOf("function");
    expect(ExtensionReactMarkdown).not.toHaveProperty("__esModule");
    expect(ExtensionReactMarkdown.uriTransformer("https://example.com")).toBe(
      "https://example.com",
    );
    expect(report).toHaveBeenCalledWith("react-markdown.uriTransformer", "defaultUrlTransform");
  });

  it.each([
    ["linkTarget", "_blank", "components.a"],
    ["renderers", { link: PlainLink }, "components"],
  ])("drops %s, a prop only react-markdown 6 took, and reports it", (name, value, replacement) => {
    const report = vi.fn();
    const ExtensionReactMarkdown = makeExtensionReactMarkdown(report);

    render(
      <ExtensionReactMarkdown {...{ [name]: value }}>
        {"[a link](https://example.com)"}
      </ExtensionReactMarkdown>,
    );

    expect(screen.getByRole("link")).not.toHaveAttribute("target");
    expect(report).toHaveBeenCalledWith(`react-markdown.${name}`, replacement);
  });

  it("runs react-markdown 6's URL transforms as 9's urlTransform, and reports them", () => {
    const report = vi.fn();
    const ExtensionReactMarkdown = makeExtensionReactMarkdown(report);

    render(
      <ExtensionReactMarkdown
        {...{
          transformImageUri: (src: string) => `file:///C:/extension/${src}`,
          transformLinkUri: (href: string) => `https://example.com/${href}`,
        }}
      >
        {"![logo](logo.png) [docs](docs)"}
      </ExtensionReactMarkdown>,
    );

    expect(screen.getByRole("img")).toHaveAttribute("src", "file:///C:/extension/logo.png");
    expect(screen.getByRole("link")).toHaveAttribute("href", "https://example.com/docs");
    expect(report).toHaveBeenCalledWith("react-markdown.transformImageUri", "urlTransform");
    expect(report).toHaveBeenCalledWith("react-markdown.transformLinkUri", "urlTransform");
  });

  it("renders without the extension's plugins if they throw, and reports them", () => {
    const report = vi.fn();
    const ExtensionReactMarkdown = makeExtensionReactMarkdown(report);
    const brokenPlugin = () => {
      throw new Error("this.setData is not a function");
    };
    // React logs the error the boundary catches.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { container } = render(
      <ExtensionReactMarkdown remarkPlugins={[brokenPlugin]}>
        {"Some **bold** text"}
      </ExtensionReactMarkdown>,
    );
    consoleError.mockRestore();

    expect(container.querySelector("strong")).not.toBeNull();
    expect(report).toHaveBeenCalledWith(
      "react-markdown.remarkPlugins",
      "a version of the plugin made for react-markdown 9",
    );
  });
});
