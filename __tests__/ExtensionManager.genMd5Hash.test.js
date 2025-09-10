import { ExtensionManager } from '../src/util/ExtensionManager';
import path from 'path';

// Mock the fileMD5 function from vortexmt
jest.mock('vortexmt', () => ({
  fileMD5: jest.fn()
}));

// Mock the setDownloadHashByFile action
jest.mock('../src/actions', () => ({
  setDownloadHashByFile: jest.fn()
}));

describe('ExtensionManager.genMd5Hash', () => {
  let extensionManager;
  let mockStore;
  let mockApi;

  beforeEach(() => {
    mockStore = {
      dispatch: jest.fn(),
      getState: jest.fn(() => ({}))
    };
    
    mockApi = {
      store: mockStore
    };
    
    // Create a minimal ExtensionManager instance for testing
    extensionManager = new ExtensionManager();
    extensionManager.mApi = mockApi;
  });

  it('should add file path context to error messages', () => {
    const testFilePath = '/path/to/test/file.txt';
    const testError = new Error('Original error message');
    
    require('vortexmt').fileMD5.mockImplementation((filePath, cb) => {
      cb(testError, null);
    });
    
    return extensionManager.genMd5Hash(testFilePath).catch(err => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe(`Failed to calculate MD5 for ${testFilePath}: Original error message`);
    });
  });

  it('should handle successful MD5 calculation', () => {
    const testFilePath = '/path/to/test/file.txt';
    const testMd5 = 'abcdef1234567890';
    const testFileSize = 1024;
    
    require('vortexmt').fileMD5.mockImplementation((filePath, cb) => {
      cb(null, testMd5);
    });
    
    return extensionManager.genMd5Hash(testFilePath).then(result => {
      expect(result).toEqual({
        md5sum: testMd5,
        numBytes: 0 // Last progress value, which defaults to 0
      });
      
      // Verify that the store dispatch was called with the correct action
      expect(mockStore.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SET_DOWNLOAD_HASH_BY_FILE'
        })
      );
    });
  });
});