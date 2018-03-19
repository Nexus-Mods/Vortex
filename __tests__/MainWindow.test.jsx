jest.mock('../src/util/ExtensionProvider');

import { MainWindow } from '../src/views/MainWindow';
import React from 'react';
import * as TestUtils from 'react-dom/test-utils';
import { findAll, findWithType, findWithClass } from 'react-shallow-testutils';

import { Label, Modal } from 'react-bootstrap';

function renderMainWindow() {
  let renderer = TestUtils.createRenderer();

  function dummyT(input) {
    return input;
  }

  const api = { events: { on: () => undefined } };

  renderer.render(<MainWindow objects={[]} t={ dummyT } api={api}/>);

  return renderer.getRenderOutput();
}

it('returns a div', () => {
  let win = renderMainWindow();
  expect(win.type).toBe('div');
});

it('has no modals', () => {
  let win = renderMainWindow();
  let modals = findAll(win, (ele) => (ele !== null) && (ele.type === Modal));

  // expecting only the Dialog Modal
  expect(modals.length).toBe(0);
});
/*
it('opens settings on click on icon', () => {
  let win = renderMainWindow();

  let modals = findAll(win, (ele) => (ele !== null) && (ele.type === Modal) && (ele.props.id === 'modal-settings'));
  expect(modals.length).toBe(1);
});
*/
