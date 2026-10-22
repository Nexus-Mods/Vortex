import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ViewButton } from "./ViewButton";
import { type IViewPickerView, ViewPicker } from "./ViewPicker";

const actions = [[{ label: "Rename", onClick: vi.fn<() => void>() }]];

const VIEWS: IViewPickerView[] = [
  { id: "one", label: "One" },
  { id: "two", label: "Two" },
  { id: "mine", label: "Mine", actions },
];

const Bar = ({
  initial = "one",
  views = VIEWS,
  onSelect = vi.fn<(id: string) => void>(),
  onAddView,
}: {
  initial?: string;
  views?: IViewPickerView[];
  onSelect?: (id: string) => void;
  onAddView?: () => void;
}) => {
  const [selected, setSelected] = useState(initial);

  return (
    <>
      <button data-testid="before" type="button" />

      <ViewPicker
        label="Views"
        selectedView={selected}
        views={views}
        onAddView={onAddView}
        onSelectView={(id) => {
          setSelected(id);
          onSelect(id);
        }}
      />
    </>
  );
};

const view = (name: string) => screen.getByRole("button", { name });

describe("ViewPicker", () => {
  it("labels its row as a group", () => {
    render(<Bar />);
    expect(screen.getByRole("group")).toHaveAccessibleName("Views");
  });

  it("marks only the open view as pressed", () => {
    render(<Bar initial="two" />);
    expect(view("One")).toHaveAttribute("aria-pressed", "false");
    expect(view("Two")).toHaveAttribute("aria-pressed", "true");
  });

  it("rules off the user's own views from the built-in ones", () => {
    const { container, unmount } = render(<Bar />);
    expect(container.querySelectorAll(".nxm-view-picker-divider")).toHaveLength(1);
    unmount();

    const { container: builtInOnly } = render(<Bar views={VIEWS.slice(0, 2)} />);
    expect(builtInOnly.querySelectorAll(".nxm-view-picker-divider")).toHaveLength(0);
  });

  it('adds a view from its "+", and has none without onAddView', async () => {
    const onAddView = vi.fn<() => void>();
    const { unmount } = render(<Bar onAddView={onAddView} />);

    await userEvent.click(screen.getByRole("button", { name: "Add view" }));
    expect(onAddView).toHaveBeenCalledTimes(1);
    unmount();

    render(<Bar />);
    expect(screen.queryByRole("button", { name: "Add view" })).toBeNull();
  });

  it('is one Tab stop, on the open view, with the "+" its own', async () => {
    render(<Bar initial="two" onAddView={vi.fn<() => void>()} />);
    screen.getByTestId("before").focus();

    await userEvent.tab();
    expect(view("Two")).toHaveFocus();

    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Add view" })).toHaveFocus();
  });

  it("moves its Tab stop with focus, and back to the open view once focus leaves", async () => {
    render(<Bar onAddView={vi.fn<() => void>()} />);
    screen.getByTestId("before").focus();

    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}");
    await userEvent.tab({ shift: true });
    expect(screen.getByTestId("before")).toHaveFocus();

    await userEvent.tab();
    expect(view("One")).toHaveFocus();
  });

  it("leaves the picker on Tab from wherever Home took focus", async () => {
    render(<Bar initial="mine" onAddView={vi.fn<() => void>()} />);
    view("Mine").focus();

    await userEvent.keyboard("{Home}");
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Add view" })).toHaveFocus();
  });

  it("puts its Tab stop on the first view when the open one isn't there", async () => {
    render(<Bar initial="gone" />);
    screen.getByTestId("before").focus();

    await userEvent.tab();
    expect(view("One")).toHaveFocus();
  });

  it("moves focus with the arrow keys, wrapping, without opening a view", async () => {
    const onSelect = vi.fn<(id: string) => void>();
    render(<Bar onSelect={onSelect} />);
    view("One").focus();

    await userEvent.keyboard("{ArrowRight}");
    expect(view("Two")).toHaveFocus();

    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(view("Mine")).toHaveFocus();

    await userEvent.keyboard("{ArrowRight}");
    expect(view("One")).toHaveFocus();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("goes to either end with Home and End", async () => {
    render(<Bar initial="two" />);
    view("Two").focus();

    await userEvent.keyboard("{End}");
    expect(view("Mine")).toHaveFocus();

    await userEvent.keyboard("{Home}");
    expect(view("One")).toHaveFocus();
  });

  it("leaves the arrow keys, Home and End alone with a modifier held", async () => {
    render(<Bar initial="two" />);
    view("Two").focus();

    await userEvent.keyboard(
      "{Alt>}{ArrowLeft}{/Alt}{Control>}{Home}{/Control}{Shift>}{End}{/Shift}",
    );
    expect(view("Two")).toHaveFocus();
  });

  it("opens the focused view with Space or Enter", async () => {
    const onSelect = vi.fn<(id: string) => void>();
    render(<Bar onSelect={onSelect} />);
    view("One").focus();

    await userEvent.keyboard("{ArrowRight} ");
    expect(onSelect).toHaveBeenLastCalledWith("two");

    await userEvent.keyboard("{ArrowRight}{Enter}");
    expect(onSelect).toHaveBeenLastCalledWith("mine");
    expect(view("Mine")).toHaveAttribute("aria-pressed", "true");
  });

  it("opens a view of the user's own from its button", async () => {
    const onSelect = vi.fn<(id: string) => void>();
    render(<Bar onSelect={onSelect} />);

    await userEvent.click(view("Mine"));
    expect(onSelect).toHaveBeenLastCalledWith("mine");
  });

  it('moves on with the arrow keys from a view\'s "…"', async () => {
    render(<Bar />);
    screen.getByRole("button", { name: /view actions/ }).focus();

    await userEvent.keyboard("{ArrowRight}");
    expect(view("One")).toHaveFocus();
  });

  it('leaves the arrow keys alone on the "+"', async () => {
    render(<Bar onAddView={vi.fn<() => void>()} />);
    screen.getByRole("button", { name: "Add view" }).focus();

    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Add view" })).toHaveFocus();
  });
});

describe("ViewButton", () => {
  const menu = { actions, label: "Mine actions" };

  it("keeps a right-click to itself without a menu", () => {
    render(<ViewButton isPressed={false}>One</ViewButton>);

    expect(fireEvent.contextMenu(screen.getByRole("button"))).toBe(false);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens its menu on a right-click, without opening the view", () => {
    const onClick = vi.fn<() => void>();
    render(
      <ViewButton isPressed={false} menu={menu} onClick={onClick}>
        Mine
      </ViewButton>,
    );

    fireEvent.contextMenu(view("Mine"));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("opens its menu with the Down arrow, without opening the view", async () => {
    const onClick = vi.fn<() => void>();
    render(
      <ViewButton isPressed={false} menu={menu} onClick={onClick}>
        Mine
      </ViewButton>,
    );
    view("Mine").focus();

    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("leaves the Down arrow alone with a modifier held, or once the caller has handled it", async () => {
    const { unmount } = render(
      <ViewButton isPressed={false} menu={menu}>
        Mine
      </ViewButton>,
    );
    view("Mine").focus();

    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(screen.queryByRole("menu")).toBeNull();
    unmount();

    render(
      <ViewButton isPressed={false} menu={menu} onKeyDown={(event) => event.preventDefault()}>
        Mine
      </ViewButton>,
    );
    view("Mine").focus();

    await userEvent.keyboard("{ArrowDown}");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it('opens its menu on a right-click on its "…"', () => {
    render(
      <ViewButton isPressed={false} menu={menu}>
        Mine
      </ViewButton>,
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: "Mine actions" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it('keeps its "…" menu open on a right-click inside it', async () => {
    render(
      <ViewButton isPressed={false} menu={menu}>
        Mine
      </ViewButton>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Mine actions" }));
    const dropdown = screen.getByRole("menu");
    fireEvent.contextMenu(screen.getByRole("menuitem", { name: "Rename" }));

    expect(screen.getByRole("menu")).toBe(dropdown);
  });

  it("does nothing with the Down arrow without a menu", async () => {
    render(<ViewButton isPressed={false}>One</ViewButton>);
    screen.getByRole("button").focus();

    await userEvent.keyboard("{ArrowDown}");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it('opens its menu from its "…", without opening the view', async () => {
    const onClick = vi.fn<() => void>();
    render(
      <ViewButton isPressed={false} menu={menu} onClick={onClick}>
        Mine
      </ViewButton>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Mine actions" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('puts its "…" beside the view, out of the Tab order', () => {
    render(
      <ViewButton isPressed menu={menu}>
        Mine
      </ViewButton>,
    );

    expect(screen.getByRole("button", { name: "Mine actions" })).toHaveAttribute("tabindex", "-1");
    expect(view("Mine")).not.toContainElement(screen.getByRole("button", { name: "Mine actions" }));
  });
});
