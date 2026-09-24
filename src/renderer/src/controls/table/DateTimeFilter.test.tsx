import { render } from "@testing-library/react";
import * as PropTypes from "prop-types";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

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

class ApiContextProvider extends React.Component<IProviderProps> {
  public static childContextTypes = {
    api: PropTypes.object,
    menuLayer: PropTypes.object,
    getModifiers: PropTypes.func,
  };

  public getChildContext() {
    return {
      api: this.props.api,
      menuLayer: document.createElement("div"),
      getModifiers: () => ({}),
    };
  }

  public render() {
    return this.props.children;
  }
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
