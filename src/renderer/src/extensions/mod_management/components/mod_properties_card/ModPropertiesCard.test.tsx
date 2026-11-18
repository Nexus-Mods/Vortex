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

  it("shows its whole description a click away", async () => {
    renderCard({ name: "SkyUI", isAdult: false, description: "[b]An interface[/b]" });
    expect(screen.queryByTestId("mod-properties-description")).toBeNull();

    await userEvent.click(screen.getByTestId("mod-properties-description-toggle"));

    expect(screen.getByTestId("mod-properties-description")).toBeInTheDocument();
    expect(
      screen.getByTestId("mod-properties-description").querySelector("b, strong"),
    ).not.toBeNull();
  });

  it("offers no description where it has none", () => {
    renderCard({ name: "SkyUI", isAdult: false });

    expect(screen.queryByTestId("mod-properties-description-toggle")).toBeNull();
  });
});
