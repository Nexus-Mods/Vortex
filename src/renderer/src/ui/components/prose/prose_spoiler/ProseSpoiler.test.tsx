import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it } from "vitest";

import { ProseSpoiler } from "./ProseSpoiler";

describe("ProseSpoiler", () => {
  it("hides what it holds until it's opened", async () => {
    render(<ProseSpoiler>The butler did it</ProseSpoiler>);

    const button = screen.getByRole("button", { name: "Spoiler" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("The butler did it")).toBeNull();

    await userEvent.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("The butler did it")).toHaveAttribute(
      "id",
      button.getAttribute("aria-controls"),
    );
  });

  it("closes again", async () => {
    render(<ProseSpoiler>The butler did it</ProseSpoiler>);

    await userEvent.click(screen.getByRole("button", { name: "Spoiler" }));
    await userEvent.click(screen.getByRole("button", { name: "Spoiler" }));

    expect(screen.queryByText("The butler did it")).toBeNull();
  });

  it("says what it's given to on its button", () => {
    render(<ProseSpoiler label="Show detailed error">Stack trace</ProseSpoiler>);

    expect(screen.getByRole("button", { name: "Show detailed error" })).toBeInTheDocument();
  });
});
