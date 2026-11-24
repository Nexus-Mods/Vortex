import { render, screen } from "@testing-library/react";
import React, { Component, type ComponentType, type ReactElement } from "react";
import { OverlayTrigger, Popover } from "react-bootstrap";
import { describe, expect, it } from "vitest";

import { MainContext } from "../../contexts/main_context/MainContext";
import type { IComponentContext } from "../../types/IComponentContext";
import { MainContextOverlayTrigger } from "./MainContextOverlay";

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

/** Renders `Trigger` inside a dialog's MainContext, with `overlay` already shown. */
function renderShownOverlay(
  Trigger: ComponentType<OverlayTrigger.OverlayTriggerProps>,
  overlay: ReactElement,
) {
  render(
    <MainContext.Provider value={dialogContext}>
      <Trigger animation={false} defaultOverlayShown placement="right" overlay={overlay}>
        <button type="button" />
      </Trigger>
    </MainContext.Provider>,
  );
}

function contextSeenInOverlay(Trigger: ComponentType<OverlayTrigger.OverlayTriggerProps>) {
  let seen: IComponentContext;
  renderShownOverlay(
    Trigger,
    <Popover id="popover">
      <Reader onContext={(context) => (seen = context)} />
    </Popover>,
  );
  return seen;
}

// A popover inside a dialog has to open its menus on the dialog's menu layer, or they sit
// behind the dialog.
describe("MainContextOverlayTrigger", () => {
  it("gives the overlay the trigger's MainContext", () => {
    const seen = contextSeenInOverlay(MainContextOverlayTrigger);

    expect(seen.menuLayer).toBe(dialogLayer);
    expect(seen.api).toBe(dialogContext.api);
  });

  it("is needed: react-bootstrap's own trigger doesn't pass the provider on", () => {
    const seen = contextSeenInOverlay(OverlayTrigger);

    expect(seen.menuLayer).not.toBe(dialogLayer);
  });

  it("keeps the overlay's own className and style alongside react-bootstrap's", () => {
    renderShownOverlay(
      MainContextOverlayTrigger,
      <Popover id="popover" className="my-popover" style={{ maxWidth: 600 }} />,
    );

    const popover = document.querySelector("#popover") as HTMLElement;
    // "right" is the placement react-bootstrap passes on
    expect(popover).toHaveClass("my-popover", "right");
    expect(popover.style.maxWidth).toBe("600px");
  });

  it("points the trigger's aria-describedby at the overlay", () => {
    renderShownOverlay(MainContextOverlayTrigger, <Popover id="popover" />);

    expect(screen.getByRole("button")).toHaveAttribute("aria-describedby", "popover");
  });
});
