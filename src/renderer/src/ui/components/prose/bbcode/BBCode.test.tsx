import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

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

  describe("media", () => {
    it("leaves out images and videos, so nothing loads from elsewhere", () => {
      const { container } = render(
        <BBCode bbcode="Hi [img]https://example.com/a.png[/img] [youtube]abc123[/youtube] there" />,
      );

      expect(container.querySelector("img, iframe")).toBeNull();
      expect(container).toHaveTextContent("Hi there");
    });
  });

  describe("links", () => {
    it("keeps a link to a web page", () => {
      render(<BBCode bbcode="[url=https://example.com/page]the page[/url]" />);

      expect(screen.getByRole("link", { name: "the page" })).toHaveAttribute(
        "href",
        "https://example.com/page",
      );
    });

    it.each([
      ["a file", "file:///C:/run.exe"],
      ["a network path", "\\\\server\\share\\run.exe"],
      ["an app", "steam://run/1"],
      ["a script", "javascript:alert(1)"],
      ["a relative path", "run.exe"],
    ])("leaves %s as text, not a link", (_name, target) => {
      render(<BBCode bbcode={`[url=${target}]open it[/url]`} />);

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.getByText("open it")).toBeInTheDocument();
    });

    it("keeps a link to a callback the caller gave, and runs it", async () => {
      const report = vi.fn();
      render(
        <BBCode bbcode="[url=cb://report/12]Review[/url]" context={{ callbacks: { report } }} />,
      );

      await userEvent.click(screen.getByRole("link", { name: "Review" }));

      expect(report).toHaveBeenCalledWith("12");
    });

    it("leaves a link to a callback nobody gave as text", () => {
      render(<BBCode bbcode="[url=cb://report/12]Review[/url]" />);

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    it("keeps a link to a local file only when the caller allows local files", () => {
      const { unmount } = render(<BBCode bbcode="[url=file:///C:/notes.txt]notes[/url]" />);
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      unmount();

      render(
        <BBCode bbcode="[url=file:///C:/notes.txt]notes[/url]" context={{ allowLocal: true }} />,
      );
      expect(screen.getByRole("link", { name: "notes" })).toHaveAttribute(
        "href",
        "file:///C:/notes.txt",
      );
    });
  });
});
