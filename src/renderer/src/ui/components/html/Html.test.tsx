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

  it("leaves out scripts and images' sources", () => {
    const { container } = render(
      <Html
        html={'<p>Hi</p><script>alert(1)</script><img src="https://example.com/a.png" alt="a">'}
      />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")?.getAttribute("src") ?? null).toBeNull();
  });
});
