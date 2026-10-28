import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { ModList } from "./ModList";

// The user's settings, which the cards read, aren't needed here.
vi.mock("react-redux", () => ({ useSelector: () => undefined }));
vi.mock("@/extensions/nexus_integration/selectors", () => ({ userInfo: () => undefined }));

type IMod = React.ComponentProps<typeof ModList>["mods"][number];

const mod = (id: string) =>
  ({
    id,
    name: `Mod ${id}`,
    summary: "",
    author: { name: "schlangster" },
    thumbnail_url: null,
    downloads: 0,
    endorsements: 0,
    created_at: "2020-01-01T00:00:00Z",
    updated_at: "2020-01-01T00:00:00Z",
    adult: false,
  }) as unknown as IMod;

const renderComponent = (props: Partial<React.ComponentProps<typeof ModList>> = {}) => {
  const onRetry = vi.fn();
  const onSelectMod = vi.fn();
  const onPageChange = vi.fn();

  render(
    <ModList
      activeModId={undefined}
      currentPage={2}
      detailsRef={createRef()}
      isError={false}
      isLoading={false}
      mods={[]}
      totalCount={100}
      onPageChange={onPageChange}
      onRetry={onRetry}
      onSelectMod={onSelectMod}
      {...props}
    />,
  );

  return { onRetry, onPageChange, onSelectMod };
};

describe("ModList", () => {
  it("keeps its pages to move off a page that failed", async () => {
    const { onPageChange } = renderComponent({ isError: true });

    await userEvent.click(screen.getByRole("button", { name: "Go to page 1" }));

    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("offers to try a failed page again", async () => {
    const { onRetry } = renderComponent({ isError: true });

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalled();
  });

  it("moves focus to the details pane on Right from a card", async () => {
    const detailsRef = createRef<HTMLDivElement>();
    render(<div data-testid="details" ref={detailsRef} tabIndex={-1} />);
    renderComponent({
      activeModId: "1",
      detailsRef,
      mods: [mod("1")],
    });

    act(() => screen.getByRole("button", { name: /Mod 1/ }).focus());
    await userEvent.keyboard("{ArrowRight}");

    expect(screen.getByTestId("details")).toHaveFocus();
  });

  it("focuses the list on a change of page, picking no mod", async () => {
    const { onPageChange, onSelectMod } = renderComponent({ mods: [mod("1"), mod("2")] });

    await userEvent.click(screen.getByRole("button", { name: "Go to page 1" }));

    expect(onPageChange).toHaveBeenCalledWith(1);
    expect(screen.getByRole("region", { name: "Mods" })).toHaveFocus();
    expect(onSelectMod).not.toHaveBeenCalled();
  });

  it.each([
    ["{ArrowDown}", "1"],
    ["{Home}", "1"],
    ["{ArrowUp}", "3"],
    ["{End}", "3"],
  ])("picks a mod from the list itself with %s", async (key, id) => {
    const { onSelectMod } = renderComponent({ mods: [mod("1"), mod("2"), mod("3")] });
    act(() => screen.getByRole("region", { name: "Mods" }).focus());

    await userEvent.keyboard(key);

    expect(onSelectMod).toHaveBeenCalledWith(id);
    expect(screen.getByRole("button", { name: new RegExp(`Mod ${id}`) })).toHaveFocus();
  });
});
