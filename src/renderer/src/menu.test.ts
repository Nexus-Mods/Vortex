import type { SerializableMenuItem } from "@vortex/shared/preload";
import { webFrame } from "electron";
import { createStore, type AnyAction } from "redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setZoomFactor } from "./actions/window";
import type ExtensionManager from "./ExtensionManager";
import { initApplicationMenu } from "./menu";
import { windowReducer } from "./reducers/window";
import type { IState } from "./types/IState";
import { ZOOM_SHORTCUT_EVENT } from "./util/zoom";

const frame = vi.hoisted(() => ({ factor: 1 }));
vi.mock("electron", () => ({
  webFrame: {
    getZoomFactor: vi.fn(() => frame.factor),
    setZoomFactor: vi.fn((factor: number) => {
      frame.factor = factor;
    }),
  },
}));
vi.mock("./util/application", () => ({ getApplication: vi.fn() }));
vi.mock("./util/getVortexPath", () => ({ default: vi.fn(() => "") }));
vi.mock("./util/i18n", () => ({ debugTranslations: vi.fn(), getMissingTranslations: vi.fn() }));
vi.mock("./util/log", () => ({ log: vi.fn() }));
vi.mock("./util/preloadAccess", () => ({ getWindowId: vi.fn() }));

function makeStore(zoomFactor: number, useModernLayout: boolean) {
  const initial = {
    settings: { window: { ...windowReducer.defaults, zoomFactor, useModernLayout } },
  } as unknown as IState;
  return createStore(
    (state: IState = initial, action: AnyAction): IState =>
      action.type === setZoomFactor.getType()
        ? {
            ...state,
            settings: {
              ...state.settings,
              window: { ...state.settings.window, zoomFactor: action.payload },
            },
          }
        : state,
  );
}

/** Builds the menu and returns a way to click one of its items by label. */
function setUpMenu(store: ReturnType<typeof makeStore>) {
  let template: SerializableMenuItem[] = [];
  let onClick: (id: string) => void = () => undefined;
  const sendNotification = vi.fn();
  (window as unknown as { api: unknown }).api = {
    menu: {
      onMenuClick: (handler: (id: string) => void) => (onClick = handler),
      setApplicationMenu: (items: SerializableMenuItem[]) => (template = items),
    },
  };
  const extensions = {
    apply: vi.fn(),
    getApi: () => ({ store, sendNotification, translate: (text: string) => text }),
  } as unknown as ExtensionManager;
  initApplicationMenu(extensions);
  const view = template.find((item) => item.label === "View")?.submenu as SerializableMenuItem[];
  const click = (label: string) => onClick(view.find((item) => item.label === label)!.id!);
  return { click, sendNotification };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("application menu zoom", () => {
  it("routes the modern layout's zoom accelerators through the store", () => {
    frame.factor = 1.2;
    const store = makeStore(1.2, true);
    const { click, sendNotification } = setUpMenu(store);
    const shortcut = vi.fn();
    window.addEventListener(ZOOM_SHORTCUT_EVENT, shortcut);
    click("Zoom In");
    click("Zoom In");
    click("Zoom Out (hidden)");
    window.removeEventListener(ZOOM_SHORTCUT_EVENT, shortcut);
    expect(store.getState().settings.window.zoomFactor).toBe(1.3);
    expect(shortcut).toHaveBeenCalledTimes(3);
    expect(sendNotification).not.toHaveBeenCalled();
    expect(webFrame.setZoomFactor).not.toHaveBeenCalled();
  });

  it("clamps modern zoom at the limits", () => {
    const store = makeStore(1.5, true);
    const { click } = setUpMenu(store);
    click("Zoom In");
    expect(store.getState().settings.window.zoomFactor).toBe(1.5);
    click("Reset Zoom");
    expect(store.getState().settings.window.zoomFactor).toBe(1);
  });

  it("keeps the legacy layout's frame zoom and toast", () => {
    frame.factor = 1;
    const store = makeStore(1, false);
    const { click, sendNotification } = setUpMenu(store);
    click("Zoom In");
    expect(webFrame.setZoomFactor).toHaveBeenLastCalledWith(1.1);
    expect(store.getState().settings.window.zoomFactor).toBe(1.1);
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ id: "zoom-factor-changed" }),
    );
  });
});
