import { render } from "@testing-library/react";
import React, { Component, type ReactElement } from "react";
import { OverlayTrigger, Popover } from "react-bootstrap";
import { describe, expect, it } from "vitest";

import { MainContext } from "../../contexts/main_context/MainContext";
import type { IComponentContext } from "../../types/IComponentContext";
import { MainContextOverlay } from "./MainContextOverlay";

const dialogLayer = document.createElement("div");
const dialogContext: IComponentContext = {
  api: { events: {} } as unknown as IComponentContext["api"],
  menuLayer: dialogLayer,
  getModifiers: () => ({ alt: false, ctrl: false, shift: false }),
};

/** Reads MainContext the way ComponentEx does. */
// eslint-disable-next-line @eslint-react/no-class-component
class Reader extends Component<{ onContext: (context: IComponentContext) => void }> {
  public static contextType = MainContext;
  declare public context: IComponentContext;

  public render() {
    this.props.onContext(this.context);
    return null;
  }
}

/** Shows `overlay` the way react-bootstrap's OverlayTrigger does: as a separate React root. */
function renderShownOverlay(wrap: (overlay: ReactElement) => ReactElement) {
  let seen: IComponentContext;
  const overlay = (
    <Popover id="popover">
      <Reader onContext={(context) => (seen = context)} />
    </Popover>
  );

  render(
    <MainContext.Provider value={dialogContext}>
      <OverlayTrigger
        animation={false}
        defaultOverlayShown
        placement="right"
        overlay={wrap(overlay)}
      >
        <button type="button" />
      </OverlayTrigger>
    </MainContext.Provider>,
  );

  return seen;
}

// A popover inside a dialog has to open its menus on the dialog's menu layer, or they sit
// behind the dialog.
describe("MainContextOverlay", () => {
  it("gives the overlay the trigger's MainContext", () => {
    const seen = renderShownOverlay((overlay) => (
      <MainContextOverlay context={dialogContext} overlay={overlay} />
    ));

    expect(seen.menuLayer).toBe(dialogLayer);
    expect(seen.api).toBe(dialogContext.api);
  });

  it("is needed: without it the overlay doesn't see the trigger's provider", () => {
    const seen = renderShownOverlay((overlay) => overlay);

    expect(seen.menuLayer).not.toBe(dialogLayer);
  });

  it("passes react-bootstrap's positioning on to the overlay", () => {
    renderShownOverlay((overlay) => (
      <MainContextOverlay context={dialogContext} overlay={overlay} />
    ));

    expect(document.querySelector("#popover")).toHaveClass("right");
  });
});
