import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import type { IExtensionApi } from "@/types/IExtensionContext";

import type { IModSearch } from "../../hooks/use_mod_search/useModSearch.hook";

// The list, bar, backdrop and details are stood in for: these test which mod the details show.
vi.mock("./browse_mods_bar/BrowseModsBar", () => ({ BrowseModsBar: () => null }));
vi.mock("./mod_backdrop/ModBackdrop", () => ({ ModBackdrop: () => null }));
vi.mock("./mod_details/ModDetails", () => ({
  ModDetails: React.forwardRef<HTMLParagraphElement, { mod: ModSummary }>(({ mod }, ref) => (
    <p data-testid="details" ref={ref}>
      {mod.name}
    </p>
  )),
}));
vi.mock("./mod_details/ModDetails.skeleton", () => ({
  ModDetailsSkeleton: () => <p data-testid="details-skeleton" />,
}));
vi.mock("./mod_list/ModList", () => ({
  ModList: ({ mods, onSelectMod }: { mods: ModSummary[]; onSelectMod: (id: string) => void }) => (
    <ul>
      {mods.map((mod) => (
        <li key={mod.id}>
          <button onClick={() => onSelectMod(mod.id)}>{mod.name}</button>
        </li>
      ))}
    </ul>
  ),
}));

import { BrowseMods } from "./BrowseMods";

const mod = (id: string) => ({ id, name: `Mod ${id}`, thumbnail_url: null }) as ModSummary;

const search = (mods: ModSummary[], loading = false) => ({ mods, loading }) as IModSearch;

const renderComponent = (initial: IModSearch) => {
  const api = {} as IExtensionApi;
  const { rerender } = render(<BrowseMods api={api} search={initial} />);
  return { rerender: (next: IModSearch) => rerender(<BrowseMods api={api} search={next} />) };
};

describe("BrowseMods", () => {
  it("shows the first mod until another's picked", async () => {
    renderComponent(search([mod("1"), mod("2")]));
    expect(screen.getByTestId("details")).toHaveTextContent("Mod 1");

    await userEvent.click(screen.getByRole("button", { name: "Mod 2" }));
    expect(screen.getByTestId("details")).toHaveTextContent("Mod 2");
  });

  it("keeps the picked mod through a change of page", async () => {
    const { rerender } = renderComponent(search([mod("1"), mod("2")]));
    await userEvent.click(screen.getByRole("button", { name: "Mod 2" }));

    rerender(search([mod("1"), mod("2")], true));
    rerender(search([mod("3"), mod("4")]));

    expect(screen.getByTestId("details")).toHaveTextContent("Mod 2");
    expect(screen.queryByTestId("details-skeleton")).not.toBeInTheDocument();
  });

  it("keeps the first mod through a change of page when none's been picked", () => {
    const { rerender } = renderComponent(search([mod("1"), mod("2")]));

    rerender(search([mod("3"), mod("4")]));

    expect(screen.getByTestId("details")).toHaveTextContent("Mod 1");
  });

  it("pulses while the first mods load, and says there's none when there aren't any", () => {
    const { rerender } = renderComponent(search([], true));
    expect(screen.getByTestId("details-skeleton")).toBeInTheDocument();

    rerender(search([]));
    expect(screen.getByText("No mod to show")).toBeInTheDocument();
  });
});
