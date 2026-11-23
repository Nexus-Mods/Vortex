import { render } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import { MainContext } from "../../contexts/main_context/MainContext";
import type { IComponentContext } from "../../types/IComponentContext";
import { DateTimeFilterComponent } from "./DateTimeFilter";

function makeApi(locale: string) {
  return {
    locale: () => locale,
    events: { on: () => undefined, off: () => undefined },
  };
}

interface IProviderProps {
  api: ReturnType<typeof makeApi>;
  children: React.ReactNode;
}

function ApiContextProvider(props: IProviderProps) {
  const context = {
    api: props.api,
    menuLayer: document.createElement("div"),
    getModifiers: () => ({ alt: false, ctrl: false, shift: false }),
  } as unknown as IComponentContext;
  return <MainContext.Provider value={context}>{props.children}</MainContext.Provider>;
}

function renderWith(locale: string, value: string = "") {
  return render(
    <ApiContextProvider api={makeApi(locale)}>
      <DateTimeFilterComponent
        filter={{ comparison: "eq", value }}
        attributeId="installed"
        t={(input: string) => input}
        onSetFilter={vi.fn()}
        domRef={() => undefined}
      />
    </ApiContextProvider>,
  );
}

describe("DateTimeFilter", () => {
  it("formats the input via the platform short date for en-US", () => {
    renderWith("en-US", "2020-12-31T00:00:00Z");
    const input = document.querySelector("input") as HTMLInputElement;
    expect(input).toBeTruthy();
    // Intl.DateTimeFormat(en-US, short) renders 12/31/20 (2-digit year).
    expect(input.value).toBe("12/31/20");
  });

  it("uses the day-first order for German", () => {
    renderWith("de", "2020-12-31T00:00:00Z");
    const input = document.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("31.12.20");
  });

  it("uses the year-first order for Japanese", () => {
    renderWith("ja", "2020-12-31T00:00:00Z");
    const input = document.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("2020/12/31");
  });
});
