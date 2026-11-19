import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MainContext } from "../contexts/main_context/MainContext";
import type { IComponentContext } from "../types/IComponentContext";
import ContextMenu from "./ContextMenu";

// ContextMenu extends ComponentEx, which reads api, menuLayer and getModifiers from
// MainContext; provide the minimum.
function ContextProvider(props: { menuLayer: HTMLElement; children: React.ReactNode }) {
  const context = {
    api: { events: { on: () => undefined, off: () => undefined } },
    menuLayer: props.menuLayer,
    getModifiers: () => ({ alt: false, ctrl: false, shift: false }),
  } as unknown as IComponentContext;
  return <MainContext.Provider value={context}>{props.children}</MainContext.Provider>;
}

function Harness(props: { menuLayer: HTMLElement }) {
  const [visible, setVisible] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });

  const onContext = React.useCallback((e: React.MouseEvent) => {
    setPosition({ x: e.clientX, y: e.clientY });
    setVisible(true);
  }, []);

  const onHide = React.useCallback(() => setVisible(false), []);

  return (
    <ContextProvider menuLayer={props.menuLayer}>
      <div data-testid="row" onContextMenu={onContext} />
      <ContextMenu
        visible={visible}
        onHide={onHide}
        position={position}
        instanceId="test-instance"
        actions={[{ title: "Test Action", action: () => undefined, show: true } as any]}
      />
    </ContextProvider>
  );
}

describe("ContextMenu", () => {
  let menuLayer: HTMLElement;

  beforeEach(() => {
    menuLayer = document.createElement("div");
    document.body.appendChild(menuLayer);
  });

  afterEach(() => {
    menuLayer.remove();
  });

  it("stays open after the right-click that opened it (React 17 delegation)", () => {
    render(<Harness menuLayer={menuLayer} />);

    // The opening contextmenu event bubbles on to document AFTER the menu's
    // root-close listeners mount; the menu must not treat it as an
    // outside-click and self-close.
    fireEvent.contextMenu(screen.getByTestId("row"), { clientX: 10, clientY: 10 });

    expect(menuLayer.textContent).toContain("Test Action");
  });

  it("closes on a subsequent outside click", async () => {
    render(<Harness menuLayer={menuLayer} />);

    fireEvent.contextMenu(screen.getByTestId("row"), { clientX: 10, clientY: 10 });
    expect(menuLayer.textContent).toContain("Test Action");

    // allow deferred root-close listener registration to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    fireEvent.click(document.body);

    await waitFor(() => {
      expect(menuLayer.textContent).not.toContain("Test Action");
    });
  });
});
