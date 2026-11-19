import { render } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it } from "vitest";

import { MainContext } from "../contexts/main_context/MainContext";
import type { IComponentContext } from "../types/IComponentContext";
import { ComponentEx, PureComponentEx } from "./ComponentEx";

const context: IComponentContext = {
  api: { events: {} } as unknown as IComponentContext["api"],
  menuLayer: document.createElement("div"),
  getModifiers: () => ({ alt: false, ctrl: true, shift: false }),
};

describe("ComponentEx", () => {
  it("reads api, menuLayer and getModifiers from MainContext", () => {
    let seen: IComponentContext;
    class Example extends ComponentEx<{}, {}> {
      public render() {
        seen = this.context;
        return null;
      }
    }

    render(
      <MainContext.Provider value={context}>
        <Example />
      </MainContext.Provider>,
    );

    expect(seen).toBe(context);
  });

  it("does the same as a PureComponentEx", () => {
    let seen: IComponentContext;
    class Example extends PureComponentEx<{}, {}> {
      public render() {
        seen = this.context;
        return null;
      }
    }

    render(
      <MainContext.Provider value={context}>
        <Example />
      </MainContext.Provider>,
    );

    expect(seen).toBe(context);
  });
});
