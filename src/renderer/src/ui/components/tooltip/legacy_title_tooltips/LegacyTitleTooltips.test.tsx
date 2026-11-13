import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it } from "vitest";

import { LegacyTitleTooltips } from "./LegacyTitleTooltips";

// --- Helpers ---

/** A legacy control's icon button, named only by its title, as Endorsed's is. */
const LegacyButton = ({ title }: { title: string }) => (
  <button title={title} type="button">
    <svg />
  </button>
);

// --- Tests ---

describe("LegacyTitleTooltips", () => {
  it("shows a hovered control's title in the modern layout's tooltip", async () => {
    render(
      <LegacyTitleTooltips>
        <LegacyButton title="Undecided" />
      </LegacyTitleTooltips>,
    );

    await userEvent.hover(screen.getByRole("button"));

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Undecided");
    expect(tooltip.querySelector(".nxm-tooltip")).not.toBeNull();
  });

  it("takes the title off the control, so the browser's own tooltip doesn't show as well", async () => {
    render(
      <LegacyTitleTooltips>
        <LegacyButton title="Undecided" />
      </LegacyTitleTooltips>,
    );

    await userEvent.hover(screen.getByRole("button"));

    expect(screen.getByRole("button")).not.toHaveAttribute("title");
  });

  it("keeps the name the title gave a control with no text of its own", async () => {
    render(
      <LegacyTitleTooltips>
        <LegacyButton title="Undecided" />
      </LegacyTitleTooltips>,
    );

    await userEvent.hover(screen.getByRole("button"));

    expect(screen.getByRole("button", { name: "Undecided" })).toBeInTheDocument();
  });

  it("leaves the name of a control with text of its own as its text", async () => {
    render(
      <LegacyTitleTooltips>
        <a href="#textures" title="Textures">
          Content
        </a>
      </LegacyTitleTooltips>,
    );

    await userEvent.hover(screen.getByRole("link"));

    expect(screen.getByRole("link", { name: "Content" })).toBeInTheDocument();
  });

  it("shows the title of whichever control is hovered, as the Content column has several", async () => {
    render(
      <LegacyTitleTooltips>
        <a href="#textures" title="Textures">
          <svg />
        </a>
        <a href="#sound" title="Music & Sound">
          <svg />
        </a>
      </LegacyTitleTooltips>,
    );

    await userEvent.hover(screen.getByRole("link", { name: "Textures" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Textures");

    await userEvent.hover(screen.getByRole("link", { name: "Music & Sound" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Music & Sound");
  });

  it("shows a title the control changes to, as Endorsed's does once endorsed", async () => {
    const { rerender } = render(
      <LegacyTitleTooltips>
        <LegacyButton title="Undecided" />
      </LegacyTitleTooltips>,
    );
    await userEvent.hover(screen.getByRole("button"));
    await screen.findByRole("tooltip");
    await userEvent.unhover(screen.getByRole("button"));

    rerender(
      <LegacyTitleTooltips>
        <LegacyButton title="Endorsed" />
      </LegacyTitleTooltips>,
    );
    await userEvent.hover(screen.getByRole("button"));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Endorsed");
    expect(screen.getByRole("button", { name: "Endorsed" })).toBeInTheDocument();
  });

  it("shows a control's title on keyboard focus", async () => {
    render(
      <LegacyTitleTooltips>
        <LegacyButton title="Mod Tracked" />
      </LegacyTitleTooltips>,
    );

    await userEvent.tab();

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Mod Tracked");
  });

  it("shows no tooltip over a control with no title", async () => {
    render(
      <LegacyTitleTooltips>
        <button type="button">2</button>
      </LegacyTitleTooltips>,
    );

    fireEvent.pointerOver(screen.getByRole("button"));
    await userEvent.hover(screen.getByRole("button"));

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
