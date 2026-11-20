import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import * as PropTypes from "prop-types";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IActionDefinitionEx } from "./ActionControl";
import ContextMenu from "./ContextMenu";

// Icon loads its font set into an `#icon-sets` element the test document lacks; a submenu
// item shows one.
vi.mock("./Icon", () => ({ default: () => null }));

// ContextMenu extends ComponentEx which reads api/menuLayer/getModifiers from
// the legacy context; provide the minimum via a legacy-context provider.
class LegacyContextProvider extends React.Component<{
  menuLayer: HTMLElement;
  children: React.ReactNode;
}> {
  public static childContextTypes = {
    api: PropTypes.object,
    menuLayer: PropTypes.object,
    getModifiers: PropTypes.func,
  };

  public getChildContext() {
    return {
      api: { events: { on: () => undefined, off: () => undefined } },
      menuLayer: this.props.menuLayer,
      getModifiers: () => ({}),
    };
  }

  public render() {
    return this.props.children;
  }
}

const testAction: IActionDefinitionEx = {
  title: "Test Action",
  action: () => undefined,
  show: true,
};

function Harness(props: { menuLayer: HTMLElement; actions?: any[] }) {
  const [visible, setVisible] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });

  const onContext = React.useCallback((e: React.MouseEvent) => {
    setPosition({ x: e.clientX, y: e.clientY });
    setVisible(true);
  }, []);

  const onHide = React.useCallback(() => setVisible(false), []);

  return (
    <LegacyContextProvider menuLayer={props.menuLayer}>
      <div data-testid="row" onContextMenu={onContext} />
      <ContextMenu
        visible={visible}
        onHide={onHide}
        position={position}
        instanceId="test-instance"
        actions={props.actions ?? [testAction]}
      />
    </LegacyContextProvider>
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
    vi.restoreAllMocks();
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

  it("places a submenu by the item that opens it", async () => {
    const measured = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");
    const more = {
      title: "More",
      show: true,
      subMenus: [{ title: "Sub Action", action: () => undefined, show: true }],
    };
    render(<Harness menuLayer={menuLayer} actions={[more]} />);
    fireEvent.contextMenu(screen.getByTestId("row"), { clientX: 10, clientY: 10 });
    const [anchor] = within(menuLayer).getAllByRole("menuitem");

    fireEvent.mouseEnter(anchor);

    await waitFor(() => expect(within(menuLayer).getAllByRole("menuitem")).toHaveLength(2));
    expect(measured.mock.contexts).toContain(anchor.closest("li"));
  });
});
