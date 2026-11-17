import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { LegacyTitled, LegacyTitleTooltips } from "./LegacyTitleTooltips";

// --- Helpers ---

/** A legacy control's icon button, named only by its title, as Endorsed's is. */
const LegacyButton = ({ title }: { title: string }) => (
  <button title={title} type="button">
    <svg />
  </button>
);

/** Legacy controls in a titled area, as an extension's cell has them, in the one tooltip's host. */
const Host = ({ children }: { children: ReactNode }) => (
  <LegacyTitleTooltips>
    <LegacyTitled>{children}</LegacyTitled>
  </LegacyTitleTooltips>
);

// --- Tests ---

describe("LegacyTitleTooltips", () => {
  it("shows a hovered control's title in the modern layout's tooltip", async () => {
    render(
      <Host>
        <LegacyButton title="Undecided" />
      </Host>,
    );

    await userEvent.hover(screen.getByRole("button"));

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Undecided");
    expect(tooltip.querySelector(".nxm-tooltip")).not.toBeNull();
  });

  it("takes the title off the control, so the browser's own tooltip doesn't show as well", async () => {
    render(
      <Host>
        <LegacyButton title="Undecided" />
      </Host>,
    );

    await userEvent.hover(screen.getByRole("button"));

    expect(screen.getByRole("button")).not.toHaveAttribute("title");
  });

  it("keeps the name the title gave a control with no text of its own", async () => {
    render(
      <Host>
        <LegacyButton title="Undecided" />
      </Host>,
    );

    await userEvent.hover(screen.getByRole("button"));

    expect(screen.getByRole("button", { name: "Undecided" })).toBeInTheDocument();
  });

  it("leaves the name of a control with text of its own as its text", async () => {
    render(
      <Host>
        <a href="#textures" title="Textures">
          Content
        </a>
      </Host>,
    );

    await userEvent.hover(screen.getByRole("link"));

    expect(screen.getByRole("link", { name: "Content" })).toBeInTheDocument();
  });

  // One tooltip serves every cell of a table, as only one title shows at a time.
  it("shows the title of whichever control is hovered, in any of its titled areas", async () => {
    render(
      <LegacyTitleTooltips>
        <LegacyTitled>
          <a href="#textures" title="Textures">
            <svg />
          </a>
        </LegacyTitled>
        <LegacyTitled>
          <a href="#sound" title="Music & Sound">
            <svg />
          </a>
        </LegacyTitled>
      </LegacyTitleTooltips>,
    );

    await userEvent.hover(screen.getByRole("link", { name: "Textures" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Textures");

    await userEvent.hover(screen.getByRole("link", { name: "Music & Sound" }));
    await waitFor(() => expect(screen.getByRole("tooltip")).toHaveTextContent("Music & Sound"));
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
  });

  // As the table's own controls, outside an extension's cell, have tooltips of their own.
  it("leaves the title of a control outside a titled area to the browser", async () => {
    render(
      <LegacyTitleTooltips>
        <LegacyButton title="Table's own" />
      </LegacyTitleTooltips>,
    );

    await userEvent.hover(screen.getByRole("button"));

    expect(screen.getByRole("button")).toHaveAttribute("title", "Table's own");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows a title the control changes to, as Endorsed's does once endorsed", async () => {
    const { rerender } = render(
      <Host>
        <LegacyButton title="Undecided" />
      </Host>,
    );
    await userEvent.hover(screen.getByRole("button"));
    await screen.findByRole("tooltip");
    await userEvent.unhover(screen.getByRole("button"));

    rerender(
      <Host>
        <LegacyButton title="Endorsed" />
      </Host>,
    );
    await userEvent.hover(screen.getByRole("button"));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Endorsed");
    expect(screen.getByRole("button", { name: "Endorsed" })).toBeInTheDocument();
  });

  // As Track becomes Untrack once clicked, with the pointer still on it.
  it("takes off and shows a title the control changes to while it's pointed at", async () => {
    const { rerender } = render(
      <Host>
        <LegacyButton title="Track" />
      </Host>,
    );
    await userEvent.hover(screen.getByRole("button"));
    await screen.findByRole("tooltip");

    rerender(
      <Host>
        <LegacyButton title="Untrack" />
      </Host>,
    );

    await waitFor(() => expect(screen.getByRole("tooltip")).toHaveTextContent("Untrack"));
    expect(screen.getByRole("button", { name: "Untrack" })).not.toHaveAttribute("title");
  });

  // As an icon is replaced once the API answers, which would leave it nothing to point at.
  it("closes when the control it points at is replaced", async () => {
    const { rerender } = render(
      <Host>
        <LegacyButton key="loading" title="Checking" />
      </Host>,
    );
    await userEvent.hover(screen.getByRole("button"));
    await screen.findByRole("tooltip");

    rerender(
      <Host>
        <LegacyButton key="loaded" title="Compatible" />
      </Host>,
    );

    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });

  it("closes when the control is pressed", async () => {
    render(
      <Host>
        <LegacyButton title="Undecided" />
      </Host>,
    );
    await userEvent.hover(screen.getByRole("button"));
    await screen.findByRole("tooltip");

    await userEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });

  it("shows a control's title on keyboard focus", async () => {
    render(
      <Host>
        <LegacyButton title="Mod Tracked" />
      </Host>,
    );

    await userEvent.tab();

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Mod Tracked");
  });

  it("shows no tooltip over a control with no title", async () => {
    render(
      <Host>
        <button type="button">2</button>
      </Host>,
    );

    fireEvent.pointerOver(screen.getByRole("button"));
    await userEvent.hover(screen.getByRole("button"));

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
