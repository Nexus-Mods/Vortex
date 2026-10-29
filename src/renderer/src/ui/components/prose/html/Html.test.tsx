import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { Html } from "./Html";

// The user's adult content setting is unknown, so adult images blur, as they do logged out.
vi.mock("react-redux", () => ({ useSelector: () => undefined }));
vi.mock("@/extensions/nexus_integration/selectors", () => ({ userInfo: () => undefined }));

describe("Html", () => {
  it("renders the HTML in the app's prose styles", () => {
    const { container } = render(
      <Html html={'<p>Fixed <b>things</b>, see <a href="https://example.com">the page</a></p>'} />,
    );

    expect(container.firstElementChild).toHaveClass("nxm-prose");
    expect(screen.getByText("things").tagName).toBe("B");
    expect(screen.getByRole("link", { name: "the page" })).toHaveAttribute(
      "href",
      "https://example.com",
    );
  });

  it("puts its content straight in the prose wrapper, so the prose spacing reaches it", () => {
    const { container } = render(<Html html="<p>One</p><p>Two</p>" />);

    expect(container.firstElementChild?.children).toHaveLength(2);
    expect(container.firstElementChild?.firstElementChild?.tagName).toBe("P");
  });

  it("comes smaller, as in a popover", () => {
    const { container } = render(<Html html="<p>Hi</p>" size="sm" />);

    expect(container.firstElementChild).toHaveClass("nxm-prose", "nxm-prose-sm");
  });

  it("shows images from Nexus Mods, blurred for an adult mod, without their srcset", () => {
    const { container } = render(
      <Html
        isFromAdultContent
        html={
          '<p>Hi <img src="https://staticdelivery.nexusmods.com/mods/1704/images/a.png" srcset="https://example.com/b.png 2x" alt="a"></p>'
        }
      />,
    );

    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://staticdelivery.nexusmods.com/mods/1704/images/a.png",
    );
    expect(container.querySelector("img")).not.toHaveAttribute("srcset");
    expect(container.querySelector("img")).toHaveClass("nxm-image-media-blurred");
  });

  it("leaves out scripts, media and images from elsewhere", () => {
    const { container } = render(
      <Html
        html={
          "<p>Hi</p><script>alert(1)</script>" +
          '<img src="https://example.com/a.png" srcset="https://example.com/b.png 2x" alt="a">' +
          '<video poster="https://example.com/p.png"><source srcset="https://example.com/s.png"></video>' +
          '<picture><source srcset="https://example.com/c.png"><img src="https://example.com/d.png"></picture>' +
          '<audio src="https://example.com/e.mp3"></audio>' +
          '<div style="background-image:url(https://example.com/f.png)">Bg</div>'
        }
      />,
    );

    expect(container.querySelector("script, img, picture, source, video, audio")).toBeNull();
    expect(container.innerHTML).not.toContain("example.com");
    expect(container).toHaveTextContent("Hi");
  });

  it("keeps links to web pages only, so one can't open a file or app", () => {
    render(
      <Html
        html={
          '<p><a href="https://example.com">web</a> <a href="file:///C:/run.exe">file</a> ' +
          '<a href="\\\\server\\share\\run.exe">share</a> <a href="steam://run/1">app</a> ' +
          '<a href="run.exe">relative</a></p>'
        }
      />,
    );

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["web"]);
  });

  describe("with media allowed", () => {
    it("keeps images and video from a web address", () => {
      const { container } = render(
        <Html
          allowMedia
          html={
            '<img src="https://example.com/a.png" alt="shot">' +
            '<video controls src="https://example.com/v.mp4" poster="https://example.com/p.png"></video>'
          }
        />,
      );

      expect(screen.getByRole("img", { name: "shot" })).toHaveAttribute(
        "src",
        "https://example.com/a.png",
      );
      expect(container.querySelector("video")).toHaveAttribute("src", "https://example.com/v.mp4");
      expect(container.querySelector("video")).toHaveAttribute(
        "poster",
        "https://example.com/p.png",
      );
    });

    it("draws its images as prose images, sized, lazily and without a referrer", () => {
      render(
        <Html allowMedia html={'<img src="https://example.com/a.png" alt="shot" width="400">'} />,
      );
      const image = screen.getByRole("img", { name: "shot" });

      expect(image).toHaveAttribute("loading", "lazy");
      expect(image).toHaveAttribute("referrerpolicy", "no-referrer");
      expect(image.closest("[style]")).toHaveStyle("--prose-image-width: 400px");
    });

    it("keeps a video GitHub wraps in details, without the summary", () => {
      const { container } = render(
        <Html
          allowMedia
          html={
            "<details open><summary>demo.mp4</summary>" +
            '<video src="https://example.com/v.mp4"></video></details>'
          }
        />,
      );

      expect(container.querySelector("video")).toHaveAttribute("src", "https://example.com/v.mp4");
      expect(container).not.toHaveTextContent("demo.mp4");
    });

    it("still leaves out media from anywhere else, and srcset, picture and audio", () => {
      const { container } = render(
        <Html
          allowMedia
          html={
            '<img src="//example.com/a.png"><img src="file:///C:/b.png"><img src="c.png">' +
            '<img src="https://example.com/d.png" srcset="https://example.com/e.png 2x">' +
            '<video src="steam://run/1" poster="file:///C:/p.png"></video>' +
            '<picture><source srcset="https://example.com/f.png"></picture>' +
            '<audio src="https://example.com/g.mp3"></audio>'
          }
        />,
      );

      expect(container.querySelectorAll("img")).toHaveLength(1);
      expect(container.querySelector("img")).not.toHaveAttribute("srcset");
      expect(container.querySelector("video")).not.toHaveAttribute("src");
      expect(container.querySelector("video")).not.toHaveAttribute("poster");
      expect(container.querySelector("picture, audio")).toBeNull();
    });

    it("still keeps links to web pages only", () => {
      render(
        <Html
          allowMedia
          html={'<a href="https://example.com">web</a> <a href="file:///C:/run.exe">file</a>'}
        />,
      );

      expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["web"]);
    });
  });
});
