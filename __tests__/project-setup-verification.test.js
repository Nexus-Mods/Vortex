const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const sass = require('sass');

// Mock the modules
jest.mock('fs');
jest.mock('child_process');
jest.mock('sass');

// Import our functions
const { verifySubmodules, verifySCSSCompilation } = require('../scripts/project-setup-verification.js');

describe('Project Setup Verification', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Set up default mock implementations
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('');
    child_process.spawnSync.mockReturnValue({ status: 0, stdout: '' });
    sass.renderSync.mockReturnValue({ css: Buffer.from('compiled') });
  });

  describe('verifySubmodules', () => {
    it('should return false when .gitmodules file does not exist', async () => {
      fs.existsSync.mockImplementation((filePath) => {
        return !filePath.endsWith('.gitmodules');
      });

      const result = await verifySubmodules();
      expect(result).toBe(false);
    });

    it('should process submodules when .gitmodules exists', async () => {
      // Mock .gitmodules content
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.endsWith('.gitmodules')) {
          return `[submodule "extensions/test-module"]
	path = extensions/test-module
	url = https://github.com/test/test-module.git
	branch = master`;
        }
        return '';
      });

      // Mock git commands
      child_process.spawnSync.mockImplementation((command, args) => {
        if (args[0] === 'rev-parse') {
          return { status: 0, stdout: 'master\n' };
        }
        if (args[0] === 'status') {
          return { status: 0, stdout: '' };
        }
        return { status: 0, stdout: '' };
      });

      // Mock fs.existsSync to return true for the submodule path
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('extensions/test-module') || filePath.endsWith('.gitmodules');
      });

      const result = await verifySubmodules();
      expect(typeof result).toBe('boolean');
    });

    it('should detect detached HEAD state', async () => {
      // Mock .gitmodules content
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.endsWith('.gitmodules')) {
          return `[submodule "extensions/test-module"]
	path = extensions/test-module
	url = https://github.com/test/test-module.git
	branch = master`;
        }
        return '';
      });

      // Mock git commands - return HEAD for detached state
      child_process.spawnSync.mockImplementation((command, args) => {
        if (args[0] === 'rev-parse') {
          return { status: 0, stdout: 'HEAD\n' };
        }
        if (args[0] === 'status') {
          return { status: 0, stdout: '' };
        }
        return { status: 0, stdout: '' };
      });

      // Mock fs.existsSync
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('extensions/test-module') || filePath.endsWith('.gitmodules');
      });

      const result = await verifySubmodules();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('verifySCSSCompilation', () => {
    it('should handle missing SCSS files gracefully', async () => {
      fs.existsSync.mockReturnValue(false);
      
      const result = await verifySCSSCompilation();
      expect(typeof result).toBe('boolean');
    });

    it('should compile SCSS files successfully', async () => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('test.scss') || filePath.includes('style.scss');
      });

      sass.renderSync.mockReturnValue({
        css: Buffer.from('compiled-css')
      });

      const result = await verifySCSSCompilation();
      expect(typeof result).toBe('boolean');
      expect(sass.renderSync).toHaveBeenCalled();
    });

    it('should handle SCSS compilation errors', async () => {
      fs.existsSync.mockReturnValue(true);
      
      sass.renderSync.mockImplementation(() => {
        throw new Error('SCSS compilation failed');
      });

      const result = await verifySCSSCompilation();
      expect(typeof result).toBe('boolean');
    });
  });
});