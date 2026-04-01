import type * as ReactTypes from "react";
import type * as ReactReduxTypes from "react-redux";

import { vi, it, expect } from "vitest";

vi.mock("../ExtensionProvider", async () => {
  const React = await vi.importActual<typeof ReactTypes>("react");
  const extend = () => (component: unknown) => component;
  const useExtensionObjects = () => [];
  const useExtensionContext = () => ({
    getApi: () => ({
      events: { on: vi.fn(), emit: vi.fn() },
      getState: vi.fn(() => ({})),
      translate: vi.fn((key: string) => key),
    }),
  });
  const ExtensionContext = React.createContext(null);
  const ExtensionProvider = ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  return {
    extend,
    useExtensionObjects,
    useExtensionContext,
    ExtensionContext,
    ExtensionProvider,
    default: {
      extend,
      useExtensionObjects,
      useExtensionContext,
      ExtensionContext,
      ExtensionProvider,
    },
  };
});
vi.mock("./layout", () => ({
  ClassicLayout: () => null,
  ModernLayout: () => null,
}));
vi.mock("../contexts", () => ({
  MainProvider: ({ children }: { children: React.ReactNode }) => children,
  MenuLayerProvider: ({ children }: { children: React.ReactNode }) => children,
  PagesProvider: ({ children }: { children: React.ReactNode }) => children,
  WindowProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("../util/MutexContext", () => ({
  MutexProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("react-i18next", () => ({
  withTranslation: () => (component: unknown) => component,
  translate: () => (component: unknown) => component,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("react-redux", async () => {
  const actual =
    await vi.importActual<typeof ReactReduxTypes>("react-redux");
  return {
    ...actual,
    useDispatch: () => vi.fn(),
    useSelector: (selector: (state: Record<string, unknown>) => unknown) => {
      const mockState = {
        session: {
          base: {
            mainPage: "",
            secondaryPage: "",
            visibleDialog: undefined,
            uiBlockers: {},
          },
          notifications: {
            dialogs: [],
            notifications: [],
            global_notifications: [],
          },
        },
        persistent: {
          profiles: {},
          mods: {},
          categories: {},
          gameMode: { discovered: {} },
        },
        settings: {
          profiles: {
            activeProfileId: "",
            nextProfileId: "",
          },
          window: {
            customTitlebar: false,
            tabsMinimized: false,
          },
          automation: {},
          interface: {
            language: "en",
          },
        },
        app: {
          appVersion: "1.0.0",
        },
      };
      try {
        return selector(mockState);
      } catch {
        return undefined;
      }
    },
  };
});

import { render } from "@testing-library/react";
import React from "react";

import { AppLayout } from "./AppLayout";

it("has no modals", () => {
  const { container } = render(<AppLayout />);
  const modals = container.querySelectorAll(".modal");

  // expecting no modals at the top level
  expect(modals.length).toBe(0);
});
