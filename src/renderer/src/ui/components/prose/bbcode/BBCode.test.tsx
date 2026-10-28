import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { BBCode } from "./BBCode";

// The user's adult content setting is unknown, so adult images blur, as they do logged out.
vi.mock("react-redux", () => ({ useSelector: () => undefined }));
vi.mock("@/extensions/nexus_integration/selectors", () => ({ userInfo: () => undefined }));

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
    it("shows images from Nexus Mods, blurred for an adult mod", () => {
      const { container } = render(
        <BBCode
          isFromAdultContent
          bbcode="Hi [img]https://staticdelivery.nexusmods.com/mods/1704/images/a.png[/img] there"
        />,
      );

      expect(container.querySelector("img")).toHaveAttribute(
        "src",
        "https://staticdelivery.nexusmods.com/mods/1704/images/a.png",
      );
      expect(container.querySelector("img")).toHaveClass("nxm-image-media-blurred");
    });

    it("leaves out images from elsewhere", () => {
      const { container } = render(
        <BBCode bbcode="Hi [img]https://example.com/a.png[/img] there" />,
      );

      expect(container.querySelector("img")).toBeNull();
      expect(container).toHaveTextContent("Hi there");
    });

    it.each([
      ["[img=right]", "[/img]"],
      ["[img align=right]", "[/img]"],
      ["[aimg=right]", "[/aimg]"],
    ])("puts an image on the side %s asks for", (open, close) => {
      const { container } = render(
        <BBCode
          bbcode={`${open}https://staticdelivery.nexusmods.com/mods/1704/images/a.png${close}`}
        />,
      );

      expect(container.querySelector("img")!.closest(".text-right")).not.toBeNull();
    });

    it.each([
      ["[img width=300,height=200]", "300px", `${300 / 200}`],
      ["[img width=300]", "300px", ""],
    ])("sizes an image as %s asks", (open, width, ratio) => {
      const { container } = render(
        <BBCode
          bbcode={`${open}https://staticdelivery.nexusmods.com/mods/1704/images/a.png[/img]`}
        />,
      );

      const wrapper = container.querySelector("img")!.closest<HTMLElement>("[style]")!;
      expect(wrapper.style.getPropertyValue("--prose-image-width")).toBe(width);
      expect(wrapper.style.getPropertyValue("--prose-image-ratio")).toBe(ratio);
    });

    it("shows both images of a comparison", () => {
      const { container } = render(
        <BBCode bbcode="[compare before=https://staticdelivery.nexusmods.com/mods/1704/images/before.png]https://staticdelivery.nexusmods.com/mods/1704/images/after.png[/compare]" />,
      );

      expect([...container.querySelectorAll("img")].map((img) => img.getAttribute("src"))).toEqual([
        "https://staticdelivery.nexusmods.com/mods/1704/images/before.png",
        "https://staticdelivery.nexusmods.com/mods/1704/images/after.png",
      ]);
    });
  });

  describe("embeds", () => {
    it.each([
      ["[youtube]abc123[/youtube]", "https://www.youtube.com/watch?v=abc123"],
      ["[video]abc123[/video]", "https://www.youtube.com/watch?v=abc123"],
      ["[soundcloud]https://soundcloud.com/a/b[/soundcloud]", "https://soundcloud.com/a/b"],
    ])("links %s instead of playing it", (bbcode, href) => {
      const { container } = render(<BBCode bbcode={bbcode} />);

      expect(screen.getByRole("link", { name: href })).toHaveAttribute("href", href);
      expect(container.querySelector("iframe")).toBeNull();
    });

    it("links a twitter handle", () => {
      render(<BBCode bbcode="[twitter]NexusSites[/twitter]" />);

      expect(screen.getByRole("link", { name: "@NexusSites" })).toHaveAttribute(
        "href",
        "https://twitter.com/NexusSites",
      );
    });

    it("leaves an embed that isn't a web page as text", () => {
      render(<BBCode bbcode="[soundcloud]file:///C:/a.mp3[/soundcloud]" />);

      expect(screen.queryByRole("link")).toBeNull();
      expect(screen.getByText("file:///C:/a.mp3")).toBeInTheDocument();
    });
  });

  describe("spoiler", () => {
    it("hides its text behind a button, labelled as the tag says", async () => {
      render(<BBCode bbcode='[spoiler label="Show detailed error"]Stack trace[/spoiler]' />);

      expect(screen.queryByText("Stack trace")).toBeNull();

      await userEvent.click(screen.getByRole("button", { name: "Show detailed error" }));

      expect(screen.getByText("Stack trace")).toBeInTheDocument();
    });

    it("opens on its text, not the blank lines it starts with", async () => {
      render(<BBCode bbcode={"[spoiler]\n<br />\n<br />Hidden<br />text[/spoiler]"} />);

      await userEvent.click(screen.getByRole("button", { name: "Spoiler" }));

      const content = screen.getByText(/Hidden/);
      expect(content.firstChild).toHaveTextContent("Hidden");
      expect(content.querySelectorAll("br")).toHaveLength(1);
    });
  });

  describe("layout", () => {
    it("aligns [left] text, rather than showing the tag", () => {
      const { container } = render(<BBCode bbcode="[left]Hi[/left]" />);

      expect(screen.getByText("Hi")).toHaveStyle({ textAlign: "left" });
      expect(container).not.toHaveTextContent("[left]");
    });

    it.each([
      ["[ol][*]a[*]b[/ol]", "ol"],
      ["[ul][*]a[*]b[/ul]", "ul"],
    ])("draws the legacy list %s as a list", (bbcode, list) => {
      const { container } = render(<BBCode bbcode={bbcode} />);

      expect(
        [...container.querySelectorAll(`${list} > li`)].map((item) => item.textContent),
      ).toEqual(["a", "b"]);
      expect(container).not.toHaveTextContent(/\[\/?[ou]l\]/);
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
      expect(screen.getByText("open it").closest("a")).toBeNull();
      expect(document.querySelector("[title]")).toBeNull();
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

  describe("size", () => {
    it.each([
      ["draws size 3 as the text's own", "[size=3]", "1em"],
      ["draws size 6 as the site does", "[size=6]", "2em"],
      ["draws size 1 as the site does", "[size=1]", "0.625em"],
      ["draws an older percentage as the size it stands for", "[size=150]", "1.125em"],
      ["leaves a size the site doesn't have at the text's own", "[size=2000]", "1em"],
      ["leaves a negative size at the text's own", "[size=-20]", "1em"],
    ])("%s", (_name, tag, fontSize) => {
      render(<BBCode bbcode={`${tag}Big[/size]`} />);

      expect(screen.getByText("Big").style.fontSize).toBe(fontSize);
    });
  });

  describe("style", () => {
    it.each(["dialog-danger-text", "dialog-success-text"])("keeps the %s class", (style) => {
      render(<BBCode bbcode={`Be [style=${style}]careful[/style] now`} />);

      expect(screen.getByText("careful")).toHaveClass(style);
    });

    it("leaves any other class off, so bbcode can't use the app's classes to cover it", () => {
      const { container } = render(
        <BBCode bbcode="Be [style=fixed inset-0 z-50]careful[/style] now" />,
      );

      expect(screen.getByText("careful")).not.toHaveAttribute("class");
      expect(container).toHaveTextContent("Be careful now");
    });
  });
});
