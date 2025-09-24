'use strict';

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

/**
 * macOS-native implementation of node-7z using 7z command-line tool
 * Provides archive handling capabilities for macOS
 */

class Stream {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return this;
  }

  emit(event, ...args) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => callback(...args));
    return this;
  }

  promise() {
    return new Promise((resolve) => {
      this.on('end', () => resolve());
    });
  }
}

class SevenZip {
  constructor(pathTo7zip) {
    this.options = {};
    this.pathTo7zip = pathTo7zip || '7z'; // Default to '7z' command
  }

  /**
   * Extract archive fully
   * @param {string} archivePath - Path to the archive file
   * @param {string} destPath - Destination path for extraction
   * @param {Object} options - Extraction options
   * @returns {Stream} Stream object for progress tracking
   */
  extractFull(archivePath, destPath, options = {}) {
    const stream = new Stream();
    
    // 7z x archive.zip -o/path/to/destination
    const command = `${this.pathTo7zip} x "${archivePath}" -o"${destPath}" -y`;
    
    process.nextTick(async () => {
      try {
        stream.emit('data', { status: 'Extracting', file: path.basename(archivePath) });
        
        // Execute the command
        const { stdout, stderr } = await execAsync(command, { 
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
          timeout: 300000 // 5 minute timeout
        });
        
        stream.emit('progress', { percent: 100 });
        stream.emit('end');
      } catch (error) {
        // Handle case where 7z is not installed
        if (error.message.includes('not found') || error.message.includes('ENOENT')) {
          stream.emit('error', new Error('7-Zip command not found. Please install 7-Zip using Homebrew: brew install p7zip'));
        } else {
          stream.emit('error', error);
        }
      }
    });
    
    return stream;
  }

  /**
   * List archive contents
   * @param {string} archivePath - Path to the archive file
   * @param {Object} options - Listing options
   * @returns {Stream} Stream object for progress tracking
   */
  list(archivePath, options = {}) {
    const stream = new Stream();
    
    // 7z l archive.zip
    const command = `${this.pathTo7zip} l "${archivePath}"`;
    
    process.nextTick(async () => {
      try {
        stream.emit('data', { status: 'Listing', file: path.basename(archivePath) });
        
        // Execute the command
        const { stdout, stderr } = await execAsync(command, { 
          maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        });
        
        // Parse the output to extract file information
        const files = this._parseListOutput(stdout);
        files.forEach(file => stream.emit('data', file));
        
        stream.emit('end');
      } catch (error) {
        // Handle case where 7z is not installed
        if (error.message.includes('not found') || error.message.includes('ENOENT')) {
          stream.emit('error', new Error('7-Zip command not found. Please install 7-Zip using Homebrew: brew install p7zip'));
        } else {
          stream.emit('error', error);
        }
      }
    });
    
    // Add promise method for compatibility
    stream.promise = () => {
      return new Promise((resolve, reject) => {
        const files = [];
        stream.on('data', (file) => files.push(file));
        stream.on('end', () => resolve(files));
        stream.on('error', reject);
      });
    };
    
    return stream;
  }

  /**
   * Parse 7z list output
   * @param {string} output - Raw output from 7z l command
   * @returns {Array} Array of file objects
   */
  _parseListOutput(output) {
    const lines = output.split('\n');
    const files = [];
    
    // Skip header lines and parse file information
    for (const line of lines) {
      // Look for lines with file information (date size compressed name)
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 4 && /^\d{4}-\d{2}-\d{2}/.test(parts[0])) {
        // This looks like a file entry
        const date = new Date(parts[0] + ' ' + parts[1]);
        const size = parseInt(parts[2]) || 0;
        const name = parts.slice(3).join(' ');
        
        files.push({
          date: date,
          attr: '', // We don't extract attributes in this simple parser
          size: size,
          name: name
        });
      }
    }
    
    return files;
  }

  /**
   * Add files to archive
   * @param {string} archivePath - Path to the archive file
   * @param {Array|string} files - Files to add to archive
   * @param {Object} options - Compression options
   * @returns {Stream} Stream object for progress tracking
   */
  add(archivePath, files, options = {}) {
    const stream = new Stream();
    
    // Convert files to array if it's a string
    const filesArray = Array.isArray(files) ? files : [files];
    
    // 7z a archive.zip file1 file2
    const command = `${this.pathTo7zip} a "${archivePath}" ${filesArray.map(f => `"${f}"`).join(' ')} -y`;
    
    process.nextTick(async () => {
      try {
        stream.emit('data', { status: 'Compressing', file: path.basename(archivePath) });
        
        // Execute the command
        const { stdout, stderr } = await execAsync(command, { 
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
          timeout: 300000 // 5 minute timeout
        });
        
        stream.emit('progress', { percent: 100 });
        stream.emit('end');
      } catch (error) {
        // Handle case where 7z is not installed
        if (error.message.includes('not found') || error.message.includes('ENOENT')) {
          stream.emit('error', new Error('7-Zip command not found. Please install 7-Zip using Homebrew: brew install p7zip'));
        } else {
          stream.emit('error', error);
        }
      }
    });
    
    return stream;
  }
}

// Export to match node-7z API
module.exports = {
  __esModule: true,
  default: SevenZip
};