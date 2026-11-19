import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { makeModsTableStore } from "@/test-utils/modsTableStore";

import type { IModPropertiesCard } from "../../hooks/use_mod_properties/useModProperties.hook";
import { ModPropertiesCard } from "./ModPropertiesCard";

const renderCard = (card: IModPropertiesCard) =>
  render(
    <Provider store={makeModsTableStore()}>
      <ModPropertiesCard card={card} />
    </Provider>,
  );

describe("ModPropertiesCard", () => {
  it("names the mod as its heading", () => {
    renderCard({ name: "SkyUI", isAdult: false });

    expect(screen.getByRole("heading")).toHaveTextContent("SkyUI");
  });

  it("tags it with its status, and only when it has one", () => {
    renderCard({ name: "SkyUI", isAdult: false, status: "update" });
    expect(screen.getByTestId("mod-status-update")).toBeInTheDocument();
  });

  it("has no status tag or footer without a status, an author or an adult mark", () => {
    renderCard({ name: "SkyUI", isAdult: false });

    expect(screen.queryByTestId(/mod-status-/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("mod-properties-card-footer")).not.toBeInTheDocument();
  });

  it("has a footer for an adult mod with no author", () => {
    renderCard({ name: "SkyUI", isAdult: true });

    expect(screen.getByTestId("mod-properties-card-footer")).toBeInTheDocument();
  });

  it("shows its whole description in a modal a click away", async () => {
    renderCard({ name: "SkyUI", isAdult: false, description: "[b]An interface[/b]" });
    expect(screen.queryByRole("dialog")).toBeNull();

    await userEvent.click(screen.getByTestId("mod-properties-description-toggle"));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toContainElement(screen.getByTestId("mod-properties-description"));
    expect(
      screen.getByTestId("mod-properties-description").querySelector("b, strong"),
    ).not.toBeNull();
  });

  it("closes the description's modal", async () => {
    renderCard({ name: "SkyUI", isAdult: false, description: "An interface" });
    await userEvent.click(screen.getByTestId("mod-properties-description-toggle"));

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stands in for images from outside Nexus Mods where the mod has a page", async () => {
    renderCard({
      name: "SkyUI",
      isAdult: false,
      description: "[img]https://i.imgur.com/a.png[/img]",
      pageUrl: "https://www.nexusmods.com/skyrimspecialedition/mods/12604",
    });
    await userEvent.click(screen.getByTestId("mod-properties-description-toggle"));

    expect(screen.getByTestId("external-image-placeholder")).toBeInTheDocument();
  });

  it("leaves out images from outside Nexus Mods where the mod has no page", async () => {
    renderCard({
      name: "SkyUI",
      isAdult: false,
      description: "[img]https://i.imgur.com/a.png[/img]",
    });
    await userEvent.click(screen.getByTestId("mod-properties-description-toggle"));

    expect(screen.queryByTestId("external-image-placeholder")).toBeNull();
  });

  it("offers no description where it has none", () => {
    renderCard({ name: "SkyUI", isAdult: false });

    expect(screen.queryByTestId("mod-properties-description-toggle")).toBeNull();
  });
});
