import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { Author } from "./Author";

describe("Author", () => {
  it("shows the name beside their avatar", () => {
    const { container } = render(
      <Author avatar="https://avatars.nexusmods.com/1/100" name="Ann" />,
    );

    expect(screen.getByText("Ann")).toBeInTheDocument();
    expect(
      container.querySelector('img[src="https://avatars.nexusmods.com/1/100"]'),
    ).not.toBeNull();
  });

  it("shows the fallback icon without an avatar", () => {
    const { container } = render(<Author name="Ann" />);

    expect(container.querySelector(".nxm-image-avatar .nxm-image-fallback")).not.toBeNull();
  });
});
