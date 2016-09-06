import { MainWindow } from '../out/views/MainWindow.js';
import React from 'react';
import TestUtils from 'react-addons-test-utils';
import { Label } from 'react-bootstrap';


function renderMainWindow() {
  let renderer = TestUtils.createRenderer();

  renderer.render(<MainWindow />);

  return renderer.getRenderOutput();
}


it('returns a label', () => {
  expect(renderMainWindow().type).toBe(Label);
});

it('says hello world', () => {
  expect(renderMainWindow().props.children).toBe('Hello World');
});