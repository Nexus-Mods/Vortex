import { act, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ModPropertyTime } from "./ModPropertyTime";

vi.mock("react-redux", () => ({
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({ settings: { interface: { language: "en" } } }),
}));

const renderTime = () =>
  render(
    <ModPropertyTime
      property={{
        kind: "time",
        id: "installTime",
        label: "Installed",
        timestamp: Date.now() - 10_000,
      }}
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
