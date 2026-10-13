import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { Html } from "./Html";

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

  it("comes smaller, as in a popover", () => {
    const { container } = render(<Html html="<p>Hi</p>" size="sm" />);

    expect(container.firstElementChild).toHaveClass("nxm-prose", "nxm-prose-sm");
  });

  it("leaves out scripts and anything that loads media from elsewhere", () => {
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
});
