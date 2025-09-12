import { getPlatformText, getStructuredPlatformText, processPlatformText } from '../src/util/platformText';

// Mock the platform detection
jest.mock('../src/util/platform', () => ({
  getCurrentPlatform: jest.fn(),
  isWindows: jest.fn(),
  isMacOS: jest.fn(),
  isLinux: jest.fn()
}));

// Import the mocked functions
import { getCurrentPlatform, isWindows, isMacOS, isLinux } from '../src/util/platform';

describe('platformText', () => {
  beforeEach(() => {
    // Reset mocks before each test
    getCurrentPlatform.mockReset();
    isWindows.mockReset();
    isMacOS.mockReset();
    isLinux.mockReset();
  });

  describe('getPlatformText', () => {
    it('should replace Ctrl with Cmd on macOS', () => {
      getCurrentPlatform.mockReturnValue('darwin');
      isMacOS.mockReturnValue(true);
      isWindows.mockReturnValue(false);
      isLinux.mockReturnValue(false);
      
      const result = getPlatformText('Press Ctrl+C to copy');
      expect(result).toBe('Press Cmd+C to copy');
    });

    it('should not replace Ctrl on Windows', () => {
      getCurrentPlatform.mockReturnValue('win32');
      isWindows.mockReturnValue(true);
      isMacOS.mockReturnValue(false);
      isLinux.mockReturnValue(false);
      
      const result = getPlatformText('Press Ctrl+C to copy');
      expect(result).toBe('Press Ctrl+C to copy');
    });

    it('should not replace Ctrl on Linux', () => {
      getCurrentPlatform.mockReturnValue('linux');
      isLinux.mockReturnValue(true);
      isWindows.mockReturnValue(false);
      isMacOS.mockReturnValue(false);
      
      const result = getPlatformText('Press Ctrl+C to copy');
      expect(result).toBe('Press Ctrl+C to copy');
    });
  });

  describe('getStructuredPlatformText', () => {
    it('should return platform-specific text when available', () => {
      getCurrentPlatform.mockReturnValue('darwin');
      isMacOS.mockReturnValue(true);
      isWindows.mockReturnValue(false);
      isLinux.mockReturnValue(false);
      
      const options = {
        win32: 'Press Ctrl+C to copy',
        darwin: 'Press Cmd+C to copy'
      };
      const result = getStructuredPlatformText(options, () => {});
      expect(result).toBe('Press Cmd+C to copy');
    });

    it('should fall back to default when platform-specific text is not available', () => {
      getCurrentPlatform.mockReturnValue('darwin');
      isMacOS.mockReturnValue(true);
      isWindows.mockReturnValue(false);
      isLinux.mockReturnValue(false);
      
      const options = {
        win32: 'Press Ctrl+C to copy',
        default: 'Press Ctrl+C to copy selected items'
      };
      const result = getStructuredPlatformText(options, () => {});
      expect(result).toBe('Press Ctrl+C to copy selected items');
    });

    it('should apply automatic replacement when no platform-specific text is available', () => {
      getCurrentPlatform.mockReturnValue('darwin');
      isMacOS.mockReturnValue(true);
      isWindows.mockReturnValue(false);
      isLinux.mockReturnValue(false);
      
      const options = {
        win32: 'Press Ctrl+C to copy'
      };
      const result = getStructuredPlatformText(options, () => {});
      expect(result).toBe('Press Cmd+C to copy');
    });
  });

  describe('processPlatformText', () => {
    it('should replace Ctrl with Cmd on macOS', () => {
      getCurrentPlatform.mockReturnValue('darwin');
      isMacOS.mockReturnValue(true);
      isWindows.mockReturnValue(false);
      isLinux.mockReturnValue(false);
      
      const result = processPlatformText('Press Ctrl+C to copy', () => {});
      expect(result).toBe('Press Cmd+C to copy');
    });

    it('should not replace Ctrl on Windows', () => {
      getCurrentPlatform.mockReturnValue('win32');
      isWindows.mockReturnValue(true);
      isMacOS.mockReturnValue(false);
      isLinux.mockReturnValue(false);
      
      const result = processPlatformText('Press Ctrl+C to copy', () => {});
      expect(result).toBe('Press Ctrl+C to copy');
    });
  });
});