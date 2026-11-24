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
  /** Whether there's a button after the last card, as Load more is while the list's paused. */
  hasAfterLastCard?: boolean;
  onPassLastCard?: () => void;
}

/** A bare list with the hook's keys, rendering cards for only the first `rendered` mods. */
const KeyboardList = ({
  count,
  rendered = count,
  searchKey = "trending",
  isLoading = false,
  onSelectMod = () => {},
  onFocusDetails = () => {},
  hasAfterLastCard = false,
  onPassLastCard,
}: IKeyboardListProps) => {
  const cards = useRef(new Map<number, HTMLElement>()).current;
  const afterLastCardRef = useRef<HTMLButtonElement>(null);
  const onKeyDown = useModListKeyboard({
    cards,
    mods: modsUpTo(count),
    searchKey,
    isLoading,
    onSelectMod,
    onFocusDetails,
    afterLastCardRef,
    onPassLastCard,
  });

  return (
    <div aria-label="Mods" role="region" tabIndex={-1} onKeyDown={onKeyDown}>
      {modsUpTo(rendered).map(({ id }, index) => (
        <div data-index={index} key={id}>
          <button
            data-testid={`card-${id}`}
            ref={(card) => {
              if (card) {
                cards.set(index, card);
                return;
              }

              cards.delete(index);
            }}
            tabIndex={-1}
            type="button"
          >
            {`Mod ${id}`}
          </button>
        </div>
      ))}

      {hasAfterLastCard && (
        <button data-testid="after-last-card" ref={afterLastCardRef} type="button">
          Load more
        </button>
      )}
    </div>
  );
};

const list = () => screen.getByRole("region");

const card = (id: string) => screen.getByTestId(`card-${id}`);

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

  it("moves focus past the last card on Down, while there's something after it", async () => {
    const onSelectMod = vi.fn();
    const onPassLastCard = vi.fn();
    render(
      <KeyboardList
        hasAfterLastCard
        count={3}
        onPassLastCard={onPassLastCard}
        onSelectMod={onSelectMod}
      />,
    );
    act(() => card("3").focus());

    await userEvent.keyboard("{ArrowDown}");

    expect(screen.getByTestId("after-last-card")).toHaveFocus();
    expect(onSelectMod).not.toHaveBeenCalled();
    expect(onPassLastCard).toHaveBeenCalledOnce();
  });

  it("picks the last mod on Up from what's after the last card", async () => {
    const onSelectMod = vi.fn();
    render(<KeyboardList hasAfterLastCard count={3} onSelectMod={onSelectMod} />);
    act(() => screen.getByTestId("after-last-card").focus());

    await userEvent.keyboard("{ArrowUp}");

    expect(onSelectMod).toHaveBeenCalledWith("3", "keyboard");
    expect(card("3")).toHaveFocus();
  });

  it.each([
    ["{Home}", "1"],
    ["{End}", "3"],
  ])("picks a mod with %s from what's after the last card", async (key, id) => {
    const onSelectMod = vi.fn();
    render(<KeyboardList hasAfterLastCard count={3} onSelectMod={onSelectMod} />);
    act(() => screen.getByTestId("after-last-card").focus());

    await userEvent.keyboard(key);

    expect(onSelectMod).toHaveBeenCalledWith(id, "keyboard");
    expect(card(id)).toHaveFocus();
  });

  it("moves focus past only the last card", async () => {
    render(<KeyboardList hasAfterLastCard count={3} />);
    act(() => card("2").focus());

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
