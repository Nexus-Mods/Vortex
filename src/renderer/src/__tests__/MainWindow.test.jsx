jest.mock('../ExtensionProvider');
jest.mock('react-i18next', () => ({
  withTranslation: () => (component) => component,
  translate: () => (component) => component,
  useTranslation: () => ({ t: (key) => key }),
}));
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: () => jest.fn(),
  useSelector: (selector) => {
    const mockState = {
      session: {
        base: {
          mainPage: '',
          secondaryPage: '',
          visibleDialog: undefined,
          uiBlockers: {},
        },
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
      },
      app: {
        appVersion: '1.0.0',
      },
    };
    return selector(mockState);
  },
}));

import { AppLayout } from '../views/AppLayout';
import React from 'react';
import { shallow } from 'enzyme';
import { findAll } from 'react-shallow-testutils';

import { Modal } from 'react-bootstrap';

function renderMainWindow() {
  return shallow(<AppLayout objects={[]} />);
}

it('has no modals', () => {
  let win = renderMainWindow();
  let modals = findAll(win, (ele) => (ele !== null) && (ele.type === Modal));

  // expecting no modals at the top level
  expect(modals.length).toBe(0);
});
