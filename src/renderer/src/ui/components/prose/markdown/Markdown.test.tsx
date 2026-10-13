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

  it("takes classes to change its colour", () => {
    const { container } = render(<Markdown className="text-neutral-subdued" markdown="Hi" />);

    expect(container.firstElementChild).toHaveClass("nxm-prose", "text-neutral-subdued");
  });

  it("comes in the body text's size, or smaller", () => {
    const { container, rerender } = render(<Markdown markdown="Hi" />);
    expect(container.firstElementChild).not.toHaveClass("nxm-prose-sm");

    rerender(<Markdown markdown="Hi" size="sm" />);
    expect(container.firstElementChild).toHaveClass("nxm-prose", "nxm-prose-sm");
  });

  it("keeps links to web pages only, so one can't open a file or app", () => {
    render(
      <Markdown
        markdown={
          "[web](https://example.com) [file](file:///C:/run.exe) " +
          "[share](\\\\server\\share\\run.exe) [app](steam://run/1) [relative](run.exe)"
        }
      />,
    );

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["web"]);
    expect(screen.getByText("file")).toBeInTheDocument();
  });

  it("leaves out images, so nothing loads from elsewhere", () => {
    const { container } = render(<Markdown markdown={"Hi ![a](https://example.com/a.png)"} />);

    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).not.toContain("example.com");
  });
});
