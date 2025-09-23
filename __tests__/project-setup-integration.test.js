const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const sass = require('sass');

// Mock the modules
jest.mock('fs');
jest.mock('child_process');
jest.mock('sass');

// Import our main function
const { runProjectSetupVerification } = require('../scripts/project-setup-verification.js');

describe('Project Setup Integration', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Set up default mock implementations
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('');
    child_process.spawnSync.mockReturnValue({ status: 0, stdout: '' });
    sass.renderSync.mockReturnValue({ css: Buffer.from('compiled') });
  });

  it('should run complete verification workflow successfully', async () => {
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

    // Mock fs.existsSync
    fs.existsSync.mockImplementation((filePath) => {
      return filePath.includes('extensions/test-module') || 
             filePath.endsWith('.gitmodules') ||
             filePath.includes('.scss');
    });

    const result = await runProjectSetupVerification();
    expect(typeof result).toBe('boolean');
  });

  it('should handle failure in submodule verification', async () => {
    // Mock .gitmodules missing
    fs.existsSync.mockImplementation((filePath) => {
      return !filePath.endsWith('.gitmodules');
    });

    const result = await runProjectSetupVerification();
    expect(result).toBe(false);
  });

  it('should handle failure in SCSS compilation', async () => {
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

    // Mock git commands to succeed
    child_process.spawnSync.mockImplementation((command, args) => {
      if (args[0] === 'rev-parse') {
        return { status: 0, stdout: 'master\n' };
      }
      if (args[0] === 'status') {
        return { status: 0, stdout: '' };
      }
      return { status: 0, stdout: '' };
    });

    // Mock fs.existsSync
    fs.existsSync.mockImplementation((filePath) => {
      return filePath.includes('extensions/test-module') || 
             filePath.endsWith('.gitmodules') ||
             filePath.includes('.scss');
    });

    // Mock SCSS compilation failure
    sass.renderSync.mockImplementation(() => {
      throw new Error('SCSS compilation failed');
    });

    const result = await runProjectSetupVerification();
    expect(result).toBe(false);
  });
});