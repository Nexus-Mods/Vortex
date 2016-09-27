import MainWindow from '../out/views/MainWindow.js';
import React from 'react';
import TestUtils from 'react-addons-test-utils';
import { findWithType, findWithClass } from 'react-shallow-testutils';

import { Label, Modal } from 'react-bootstrap';

jest.mock('../out/util/ExtensionProvider');

function renderMainWindow() {
  let renderer = TestUtils.createRenderer();

  renderer.render(React.createElement('MainWindow'));

  return renderer.getRenderOutput();
}

it('returns a div', () => {
  let win = renderMainWindow();
  expect(win.type).to.equal('div');
});

it('has one modal', () => {
  let win = renderMainWindow();

  let modals = findWithType(win, Modal);

  expect(modals.length).toBe(1);
});

it('opens settings on click on icon', () => {
  let win = renderMainWindow();

  let modals = findWithType(win, Modal);

  expect(modals[0].id).toBe('modal-settings');

});