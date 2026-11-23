import { render } from "@testing-library/react";
import * as PropTypes from "prop-types";
import * as React from "react";
import { describe, expect, it } from "vitest";

import { ComponentExProvider, MainContext } from "../contexts/main_context/MainContext";
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

  // Community extensions written against ComponentEx's old legacy context keep working.
  describe("for extensions that read legacy context", () => {
    function renderInApp(element: React.ReactElement) {
      render(
        <MainContext.Provider value={context}>
          <ComponentExProvider>{element}</ComponentExProvider>
        </MainContext.Provider>,
      );
    }

    it("still has ComponentEx.contextTypes, for a plain class that copies it", () => {
      let seen: Partial<IComponentContext>;
      class LegacyContextExtension extends React.Component {
        public static contextTypes = ComponentEx.contextTypes;

        public render() {
          seen = this.context;
          return null;
        }
      }

      renderInApp(<LegacyContextExtension />);

      expect(seen.api).toBe(context.api);
    });

    it("doesn't pass ComponentEx.contextTypes on to subclasses, which read MainContext", () => {
      class Example extends ComponentEx<{}, {}> {
        public render() {
          return null;
        }
      }

      expect(Example.contextTypes).toBeUndefined();
      expect(Example.contextType).toBe(MainContext);
    });

    it("gives a subclass that declares contextTypes of its own legacy context, as before", () => {
      let seen: Partial<IComponentContext>;
      class LegacyContextExtension extends ComponentEx<{}, {}> {
        public static contextTypes = { menuLayer: PropTypes.object };

        public render() {
          seen = this.context;
          return null;
        }
      }

      renderInApp(<LegacyContextExtension />);

      // legacy context holds just the keys the class declared
      expect(seen).toEqual({ menuLayer: context.menuLayer });
    });

    it("lets a subclass assign contextTypes, as older compilers emit class fields", () => {
      let seen: Partial<IComponentContext>;
      class LegacyContextExtension extends PureComponentEx<{}, {}> {
        public render() {
          seen = this.context;
          return null;
        }
      }
      LegacyContextExtension.contextTypes = { menuLayer: PropTypes.object };

      renderInApp(<LegacyContextExtension />);

      expect(seen).toEqual({ menuLayer: context.menuLayer });
    });
  });
});
