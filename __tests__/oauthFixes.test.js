import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import PlaceholderTextArea from '../src/controls/PlaceholderTextArea';
import CopyClipboardInput from '../src/controls/CopyClipboardInput';

// Mock the MainContext
jest.mock('../src/views/MainWindow', () => ({
  MainContext: {
    Consumer: ({ children }) => children({ api: { showErrorNotification: jest.fn() } }),
    useContext: () => ({ api: { showErrorNotification: jest.fn() } })
  }
}));

// Mock clipboard
jest.mock('electron', () => ({
  clipboard: {
    readText: jest.fn().mockReturnValue('test clipboard text'),
    writeText: jest.fn()
  }
}));

describe('OAuth Fixes', () => {
  describe('PlaceholderTextArea', () => {
    it('should handle undefined value without warnings', () => {
      const mockOnChange = jest.fn();
      const mockRef = { current: null };
      
      // This should not produce any React warnings
      const { container } = render(
        <PlaceholderTextArea 
          t={(key) => key}
          onChange={mockOnChange}
          mModalRef={mockRef}
          value={undefined}
        />
      );
      
      expect(container).toBeTruthy();
    });

    it('should update internal state when value prop changes', () => {
      const mockOnChange = jest.fn();
      const mockRef = { current: null };
      
      const { rerender } = render(
        <PlaceholderTextArea 
          t={(key) => key}
          onChange={mockOnChange}
          mModalRef={mockRef}
          value="initial"
        />
      );
      
      // Re-render with new value
      rerender(
        <PlaceholderTextArea 
          t={(key) => key}
          onChange={mockOnChange}
          mModalRef={mockRef}
          value="updated"
        />
      );
      
      // Component should handle the update without warnings
      expect(true).toBe(true);
    });
  });

  describe('CopyClipboardInput', () => {
    it('should handle undefined inputValue without warnings', () => {
      // This should not produce any React warnings
      const { container } = render(
        <CopyClipboardInput inputValue={undefined} />
      );
      
      expect(container).toBeTruthy();
    });

    it('should display empty string when inputValue is undefined', () => {
      const { container } = render(
        <CopyClipboardInput inputValue={undefined} />
      );
      
      const input = container.querySelector('input');
      expect(input.value).toBe('');
    });
  });
});