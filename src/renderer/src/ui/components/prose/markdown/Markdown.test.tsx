import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { Markdown } from "./Markdown";

// The user's adult content setting is unknown, so adult images blur, as they do logged out.
vi.mock("react-redux", () => ({ useSelector: () => undefined }));
vi.mock("@/extensions/nexus_integration/selectors", () => ({ userInfo: () => undefined }));

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

  it("shows images from Nexus Mods, blurred for an adult mod", () => {
    const { container } = render(
      <Markdown
        isFromAdultContent
        markdown={"Hi ![a](https://staticdelivery.nexusmods.com/mods/1704/images/a.png)"}
      />,
    );

    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://staticdelivery.nexusmods.com/mods/1704/images/a.png",
    );
    expect(container.querySelector("img")).toHaveClass("nxm-image-media-blurred");
  });

  it("leaves out images from elsewhere", () => {
    const { container } = render(<Markdown markdown={"Hi ![a](https://example.com/a.png)"} />);

    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).not.toContain("example.com");
  });

  describe("with media allowed", () => {
    it("keeps images from a web address", () => {
      render(<Markdown allowMedia markdown={"![shot](https://example.com/a.png)"} />);

      expect(screen.getByRole("img", { name: "shot" })).toHaveAttribute(
        "src",
        "https://example.com/a.png",
      );
    });

    it("draws its images as prose images, lazily and without a referrer", () => {
      render(<Markdown allowMedia markdown={"![shot](https://example.com/a.png)"} />);
      const image = screen.getByRole("img", { name: "shot" });

      expect(image).toHaveAttribute("loading", "lazy");
      expect(image).toHaveAttribute("referrerpolicy", "no-referrer");
    });

    it("still leaves out images from anywhere else", () => {
      const { container } = render(
        <Markdown
          allowMedia
          markdown={"![a](//example.com/a.png) ![b](file:///C:/b.png) ![c](c.png)"}
        />,
      );

      expect(container.querySelector("img")).toBeNull();
    });
  });
});
