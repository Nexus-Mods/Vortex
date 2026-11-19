import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ModPropertyTime } from "./ModPropertyTime";

vi.mock("react-redux", () => ({
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({ settings: { interface: { language: "en" } } }),
}));

const renderTime = (timestamp = Date.now() - 10_000) =>
  render(
    <ModPropertyTime
      property={{ kind: "time", id: "installTime", label: "Installed", timestamp }}
    />,
  );

describe("ModPropertyTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows how long ago, under its label", () => {
    renderTime();

    expect(screen.getByTestId("mod-property-installTime")).toHaveTextContent("Installed");
    expect(screen.getByTestId("mod-property-installTime")).toHaveTextContent("seconds ago");
  });

  it("shows its full date and time on hover, not as a title", async () => {
    // The tooltip places itself on animation frames, which fake timers hold back.
    vi.useRealTimers();
    const timestamp = Date.now() - 10_000;
    renderTime(timestamp);
    const shown = screen.getByTestId("mod-property-installTime").querySelector(".truncate")!;

    expect(shown).not.toHaveAttribute("title");
    await userEvent.hover(shown);

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(timestamp),
    );
  });

  it("ages the time shown", () => {
    renderTime();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    const shown = screen.getByTestId("mod-property-installTime");
    expect(shown).not.toHaveTextContent("seconds ago");
    expect(shown).toHaveTextContent("minute ago");
  });
});
