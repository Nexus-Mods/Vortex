import { vi, it, expect } from "vitest";

vi.mock('../ExtensionProvider');
vi.mock('../views/layout', () => ({
  ClassicLayout: () => null,
  ModernLayout: () => null,
}));
vi.mock('../contexts', () => ({
  MainProvider: ({ children }) => children,
  MenuLayerProvider: ({ children }) => children,
  PagesProvider: ({ children }) => children,
  WindowProvider: ({ children }) => children,
}));
vi.mock('../util/MutexContext', () => ({
  MutexProvider: ({ children }) => children,
}));
vi.mock('react-i18next', () => ({
  withTranslation: () => (component) => component,
  translate: () => (component) => component,
  useTranslation: () => ({ t: (key) => key }),
}));
vi.mock('react-redux', async () => {
  const actual = await vi.importActual('react-redux');
  return {
    ...actual,
    useDispatch: () => vi.fn(),
    useSelector: (selector) => {
      const mockState = {
        session: {
          base: {
            mainPage: '',
            secondaryPage: '',
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
            activeProfileId: '',
            nextProfileId: '',
          },
          window: {
            customTitlebar: false,
            tabsMinimized: false,
          },
          automation: {},
          interface: {
            language: 'en',
          },
        },
        app: {
          appVersion: '1.0.0',
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

import { AppLayout } from '../views/AppLayout';
import React from 'react';
import { render } from '@testing-library/react';

it('has no modals', () => {
  const { container } = render(<AppLayout objects={[]} />);
  const modals = container.querySelectorAll('.modal');

  // expecting no modals at the top level
  expect(modals.length).toBe(0);
});
