import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useRef } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";

import { useModListKeyboard } from "./useModListKeyboard.hook";

/** So many mods, with ids from 1. */
const modsUpTo = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `${i + 1}` }) as ModSummary);

interface IKeyboardListProps {
  /** How many mods the list has. */
  count: number;
  /** How many of them have cards rendered, from the first. */
  rendered?: number;
  searchKey?: string;
  isLoading?: boolean;
  onSelectMod?: Parameters<typeof useModListKeyboard>[0]["onSelectMod"];
  onFocusDetails?: () => void;
}

/** A bare list with the hook's keys, rendering cards for only the first `rendered` mods. */
const KeyboardList = ({
  count,
  rendered = count,
  searchKey = "trending",
  isLoading = false,
  onSelectMod = () => {},
  onFocusDetails = () => {},
}: IKeyboardListProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const onKeyDown = useModListKeyboard({
    scrollRef,
    mods: modsUpTo(count),
    searchKey,
    isLoading,
    onSelectMod,
    onFocusDetails,
  });

  return (
    <div aria-label="Mods" ref={scrollRef} role="region" tabIndex={-1} onKeyDown={onKeyDown}>
      {modsUpTo(rendered).map(({ id }, index) => (
        <div data-index={index} key={id}>
          <button data-mod-card tabIndex={-1} type="button">
            {`Mod ${id}`}
          </button>
        </div>
      ))}
    </div>
  );
};

const list = () => screen.getByRole("region", { name: "Mods" });

const card = (id: string) => screen.getByRole("button", { name: `Mod ${id}` });

describe("useModListKeyboard", () => {
  it.each([
    ["{ArrowDown}", "1"],
    ["{Home}", "1"],
    ["{ArrowUp}", "3"],
    ["{End}", "3"],
  ])("picks a mod from the list itself with %s", async (key, id) => {
    const onSelectMod = vi.fn();
    render(<KeyboardList count={3} onSelectMod={onSelectMod} />);
    act(() => list().focus());

    await userEvent.keyboard(key);

    expect(onSelectMod).toHaveBeenCalledWith(id, "keyboard");
    expect(card(id)).toHaveFocus();
  });

  it.each([
    ["{ArrowDown}", "3"],
    ["{ArrowUp}", "1"],
    ["{Home}", "1"],
    ["{End}", "3"],
  ])("moves from a card with %s", async (key, id) => {
    const onSelectMod = vi.fn();
    render(<KeyboardList count={3} onSelectMod={onSelectMod} />);
    act(() => card("2").focus());

    await userEvent.keyboard(key);

    expect(onSelectMod).toHaveBeenCalledWith(id, "keyboard");
    expect(card(id)).toHaveFocus();
  });

  it("stays on the last mod with Down from it", async () => {
    render(<KeyboardList count={3} />);
    act(() => card("3").focus());

    await userEvent.keyboard("{ArrowDown}");

    expect(card("3")).toHaveFocus();
  });

  it("asks to move focus to the details on Right from a card", async () => {
    const onFocusDetails = vi.fn();
    render(<KeyboardList count={3} onFocusDetails={onFocusDetails} />);
    act(() => card("1").focus());

    await userEvent.keyboard("{ArrowRight}");

    expect(onFocusDetails).toHaveBeenCalled();
  });

  it("picks nothing while the first page loads", async () => {
    const onSelectMod = vi.fn();
    render(<KeyboardList isLoading count={3} onSelectMod={onSelectMod} />);
    act(() => list().focus());

    await userEvent.keyboard("{ArrowDown}{End}");

    expect(onSelectMod).not.toHaveBeenCalled();
  });

  it("leaves keys with a modifier alone", async () => {
    const onSelectMod = vi.fn();
    render(<KeyboardList count={3} onSelectMod={onSelectMod} />);
    act(() => list().focus());

    await userEvent.keyboard("{Control>}{ArrowDown}{/Control}");

    expect(onSelectMod).not.toHaveBeenCalled();
  });

  it("focuses a mod picked before its card renders, once it does", async () => {
    const { rerender } = render(<KeyboardList count={50} rendered={3} />);
    act(() => list().focus());
    await userEvent.keyboard("{End}");

    rerender(<KeyboardList count={50} />);

    expect(card("50")).toHaveFocus();
  });

  it("drops a focus still waiting when the search changes", async () => {
    const { rerender } = render(<KeyboardList count={50} rendered={3} />);
    act(() => list().focus());
    await userEvent.keyboard("{End}");

    rerender(<KeyboardList count={50} searchKey="new" />);

    expect(card("50")).not.toHaveFocus();
  });
});
