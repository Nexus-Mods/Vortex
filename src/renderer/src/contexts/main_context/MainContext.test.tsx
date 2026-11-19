import { render } from "@testing-library/react";
import * as PropTypes from "prop-types";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { IComponentContext } from "../../types/IComponentContext";
import { ComponentExProvider, MainContext, setMainContextFallback } from "./MainContext";

const api = { events: {} } as unknown as IComponentContext["api"];
const menuLayer = document.createElement("div");
const value: IComponentContext = { api, menuLayer, getModifiers: () => undefined };

/** Reads MainContext the way ComponentEx does. */
class Reader extends React.Component<{ onContext: (context: IComponentContext) => void }> {
  public static contextType = MainContext;
  declare public context: IComponentContext;

  public render() {
    this.props.onContext(this.context);
    return null;
  }
}

afterEach(() => {
  setMainContextFallback({ api: undefined, menuLayer: undefined, getModifiers: undefined });
});

describe("MainContext", () => {
  // Community extensions may still declare contextTypes of their own instead of extending
  // ComponentEx. ComponentExProvider keeps handing them the same values.
  it("passes MainContext on to a component that reads old-style context", () => {
    let seen: Partial<IComponentContext>;
    class LegacyContextExtension extends React.Component {
      public static contextTypes = { api: PropTypes.object, menuLayer: PropTypes.object };

      public render() {
        seen = this.context;
        return null;
      }
    }

    render(
      <MainContext.Provider value={value}>
        <ComponentExProvider>
          <LegacyContextExtension />
        </ComponentExProvider>
      </MainContext.Provider>,
    );

    expect(seen).toEqual({ api, menuLayer });
  });

  // react-bootstrap 0.33's OverlayTrigger renders its overlay as a separate root, which no
  // provider is above.
  it("gives a component with no provider above it the app-wide values", () => {
    let seen: IComponentContext;
    setMainContextFallback(value);

    render(<Reader onContext={(context) => (seen = context)} />);

    expect(seen.api).toBe(api);
    expect(seen.menuLayer).toBe(menuLayer);
  });

  it("prefers a provider's values over the app-wide ones", () => {
    let seen: IComponentContext;
    const dialogLayer = document.createElement("div");
    setMainContextFallback(value);

    render(
      <MainContext.Provider value={{ ...value, menuLayer: dialogLayer }}>
        <Reader onContext={(context) => (seen = context)} />
      </MainContext.Provider>,
    );

    expect(seen.menuLayer).toBe(dialogLayer);
  });
});
