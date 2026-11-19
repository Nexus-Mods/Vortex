import { render } from "@testing-library/react";
import * as PropTypes from "prop-types";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MainContext } from "../contexts/main_context/MainContext";
import type { IComponentContext } from "../types/IComponentContext";
import { ComponentEx } from "./ComponentEx";
import Modal from "./Modal";

const appLayer = document.createElement("div");
const context: IComponentContext = {
  api: { events: {} } as unknown as IComponentContext["api"],
  menuLayer: appLayer,
  getModifiers: () => undefined,
};

let overlays: HTMLElement;

beforeEach(() => {
  // the dialog mounts into the app's overlay host
  overlays = document.createElement("div");
  overlays.id = "overlays";
  document.body.appendChild(overlays);
});

afterEach(() => {
  overlays.remove();
});

// A menu opened inside a dialog goes on the dialog's own menu layer, so it sits above the
// dialog instead of behind it.
describe("Modal", () => {
  it("gives what's inside it the dialog's menu layer and the app's api", () => {
    let seen: IComponentContext;
    class Inside extends ComponentEx<{}, {}> {
      public render() {
        seen = this.context;
        return null;
      }
    }

    render(
      <MainContext.Provider value={context}>
        <Modal show={true} onHide={() => undefined}>
          <Inside />
        </Modal>
      </MainContext.Provider>,
    );

    expect(seen.api).toBe(context.api);
    expect(seen.menuLayer).toBe(document.querySelector(".modal .menu-layer"));
  });

  it("gives the same to a component that reads old-style context", () => {
    let seen: Partial<IComponentContext>;
    class LegacyContextExtension extends React.Component {
      public static contextTypes = { api: PropTypes.object, menuLayer: PropTypes.object };

      public render() {
        seen = this.context;
        return null;
      }
    }

    render(
      <MainContext.Provider value={context}>
        <Modal show={true} onHide={() => undefined}>
          <LegacyContextExtension />
        </Modal>
      </MainContext.Provider>,
    );

    expect(seen.menuLayer).toBe(document.querySelector(".modal .menu-layer"));
  });
});
