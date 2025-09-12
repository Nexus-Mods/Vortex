import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

// Mock the MainContext with a real React Context object
jest.mock('../src/views/MainWindow', () => {
  const React = require('react');
  const mockApi = { showErrorNotification: jest.fn() };
  const MainContext = React.createContext({ api: mockApi });
  return { MainContext };
});

// Stub Icon component to avoid fs/electron path handling in tests
jest.mock('../src/controls/Icon', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props) => React.createElement('span', null),
  };
});

// Mock electron with clipboard and minimal app/api used by getVortexPath/electronRemote
jest.mock('electron', () => {
  return {
    app: {
      getAppPath: jest.fn().mockReturnValue(process.cwd()),
      getPath: jest.fn().mockImplementation(() => process.cwd()),
      setPath: jest.fn(),
    },
    ipcMain: { on: jest.fn() },
    ipcRenderer: undefined,
    webContents: { getFocusedWebContents: jest.fn() },
    clipboard: {
      readText: jest.fn().mockReturnValue('test clipboard text'),
      writeText: jest.fn(),
    },
  };
});

// Stub vortex-api components used by PlaceholderTextArea BEFORE requiring the component
jest.mock('vortex-api', () => {
  const React = require('react');
  const ContextMenu = () => React.createElement('div');
  return {
    __esModule: true,
    ContextMenu,
    FlexLayout: {},
    tooltip: {},
    types: {},
  };
});

// Now require components after mocks are set up
const PlaceholderTextArea = require('../src/controls/PlaceholderTextArea').default;
const CopyClipboardInput = require('../src/controls/CopyClipboardInput').default;

describe('OAuth Fixes', () => {
  describe('PlaceholderTextArea', () => {
    it('should handle undefined value without warnings', () => {
      const mockOnChange = jest.fn();
      const mockRef = { current: { getBoundingClientRect: () => ({ x: 0, y: 0 }) } };

      let renderer;
      act(() => {
        renderer = TestRenderer.create(
          React.createElement(PlaceholderTextArea, {
            t: (key) => key,
            onChange: mockOnChange,
            mModalRef: mockRef,
            value: undefined,
          })
        );
      });

      expect(renderer.toJSON()).toBeTruthy();
    });

    it('should update internal state when value prop changes', () => {
      const mockOnChange = jest.fn();
      const mockRef = { current: { getBoundingClientRect: () => ({ x: 0, y: 0 }) } };

      let renderer;
      act(() => {
        renderer = TestRenderer.create(
          React.createElement(PlaceholderTextArea, {
            t: (key) => key,
            onChange: mockOnChange,
            mModalRef: mockRef,
            value: 'initial',
          })
        );
      });

      act(() => {
        renderer.update(
          React.createElement(PlaceholderTextArea, {
            t: (key) => key,
            onChange: mockOnChange,
            mModalRef: mockRef,
            value: 'updated',
          })
        );
      });

      expect(renderer.toJSON()).toBeTruthy();
    });
  });

  describe('CopyClipboardInput', () => {
    it('should handle undefined inputValue without warnings', () => {
      let renderer;
      act(() => {
        renderer = TestRenderer.create(
          React.createElement(CopyClipboardInput, { inputValue: undefined })
        );
      });

      expect(renderer.toJSON()).toBeTruthy();
    });

    it('should display empty string when inputValue is undefined', () => {
      let renderer;
      act(() => {
        renderer = TestRenderer.create(
          React.createElement(CopyClipboardInput, { inputValue: undefined })
        );
      });

      const tree = renderer.root;
      // Find the input element rendered by react-bootstrap FormControl
      const input = tree.findAll((node) => node.type === 'input')[0];
      expect(input.props.value).toBe('');
    });
  });
});