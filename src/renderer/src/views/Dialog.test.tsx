import { render, screen } from "@testing-library/react";
import React from "react";
import type * as ReactReduxTypes from "react-redux";
import { describe, expect, it, vi } from "vitest";

import type { IDialog } from "../types/IDialog";
import { canRenderWithModal } from "./utils/can_render_with_modal/canRenderWithModal.util";

/** Rewritten per test, then read by the real selector through the mocked hook. */
const store = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));

vi.mock("react-redux", async () => {
  const actual = await vi.importActual<typeof ReactReduxTypes>("react-redux");

  return {
    ...actual,
    useDispatch: () => vi.fn(),
    useSelector: (selector: (state: unknown) => unknown) => selector(store.state),
  };
});

// A new dialog brings the window to the front, which needs the preload bridge.
vi.mock("../util/preloadAccess", () => ({
  getWindowId: () => 1,
  getPreloadApi: () => ({
    window: {
      isMinimized: () => Promise.resolve(false),
      restore: () => Promise.resolve(),
      setAlwaysOnTop: () => Promise.resolve(),
      show: () => Promise.resolve(),
    },
  }),
}));

// Icon loads its font set into an `#icon-sets` element the real document has and this
// one doesn't. Nothing here turns on which glyph is drawn.
vi.mock("../controls/Icon", () => ({ default: () => null }));

import { Dialog } from "./Dialog";

/**
 * A dialog with HTML from somewhere we don't control. The checkbox's `subText` is something
 * ModalLayer can't draw, so this dialog goes to the legacy renderer.
 */
const legacyDialogWithHtml = (htmlText: string): IDialog => ({
  id: "html-dialog",
  type: "info",
  title: "Notes",
  content: {
    htmlText,
    checkboxes: [{ id: "keep", text: "Keep", value: false, subText: "Help" }],
  },
  defaultAction: "Close",
  actions: ["Close"],
});

const renderDialog = (dialog: IDialog) => {
  store.state = { session: { notifications: { dialogs: [dialog] } } };
  render(<Dialog />);
};

describe("Dialog", () => {
  it("leaves scripts and inline event handlers out of htmlText", async () => {
    const dialog = legacyDialogWithHtml(
      '<p>Safe <b>notes</b></p><script>window.ran = true</script><img src="x" onerror="window.ran = true"><span onclick="window.ran = true">Click</span>',
    );
    expect(canRenderWithModal(dialog)).toBe(false);

    renderDialog(dialog);

    const notes = await screen.findByText("notes");
    expect(notes.tagName).toBe("B");

    const html = document.body.querySelector(".dialog-content-html");
    expect(html).not.toBeNull();
    expect(html?.querySelector("script")).toBeNull();
    expect(html?.querySelector("[onerror], [onclick]")).toBeNull();
    expect(html?.innerHTML).not.toContain("window.ran");
  });
});
