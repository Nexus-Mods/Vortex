import { MainWindow } from '../out/views/MainWindow.js';
import React from 'react';
import TestUtils from 'react-addons-test-utils';
import { findAll, findWithType, findWithClass } from 'react-shallow-testutils';

import { Label, Modal } from 'react-bootstrap';

jest.mock('../out/util/ExtensionProvider');

function renderMainWindow() {
  let renderer = TestUtils.createRenderer();

  function dummyT(input) {
    return input;
  }

  renderer.render(<MainWindow objects={[]} t={ dummyT } />, { api: { bla: 'blubb' } });

  return renderer.getRenderOutput();
}

it('returns a div', () => {
  let win = renderMainWindow();
  expect(win.type).toBe('div');
});

it('has three modal', () => {
  let win = renderMainWindow();

  let modals = findAll(win, (ele) => ele.type === Modal);

  expect(modals.length).toBe(3);
});

it('opens settings on click on icon', () => {
  let win = renderMainWindow();

  let modals = findAll(win, (ele) => (ele.type === Modal) && (ele.props.id === 'modal-settings'));
  expect(modals.length).toBe(1);
});
