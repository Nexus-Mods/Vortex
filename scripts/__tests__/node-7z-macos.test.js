'use strict';

const { default: SevenZip } = require('../node-7z-macos');

// Mock child_process.exec to avoid actually calling system commands
jest.mock('child_process', () => {
  return {
    exec: jest.fn((command, options, callback) => {
      if (typeof options === 'function') {
        callback = options;
      }
      // Simulate successful execution
      callback(null, { stdout: '', stderr: '' });
    }),
    promisify: (fn) => fn
  };
});

describe('node-7z-macos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SevenZip', () => {
    it('should create SevenZip instance with default 7z command', () => {
      const sevenZip = new SevenZip();
      expect(sevenZip.pathTo7zip).toBe('7z');
    });

    it('should create SevenZip instance with custom 7z command', () => {
      const customPath = '/usr/local/bin/7zz';
      const sevenZip = new SevenZip(customPath);
      expect(sevenZip.pathTo7zip).toBe(customPath);
    });
  });

  describe('extractFull', () => {
    it('should emit data and end events', (done) => {
      const sevenZip = new SevenZip();
      const stream = sevenZip.extractFull('/path/to/archive.zip', '/path/to/dest');
      
      const events = [];
      stream.on('data', (data) => events.push({ type: 'data', data }));
      stream.on('end', () => {
        events.push({ type: 'end' });
        expect(events).toHaveLength(2);
        expect(events[0].type).toBe('data');
        expect(events[0].data.status).toBe('Extracting');
        expect(events[1].type).toBe('end');
        done();
      });
    });
  });

  describe('list', () => {
    it('should emit data and end events', (done) => {
      const sevenZip = new SevenZip();
      const stream = sevenZip.list('/path/to/archive.zip');
      
      const events = [];
      stream.on('data', (data) => events.push({ type: 'data', data }));
      stream.on('end', () => {
        events.push({ type: 'end' });
        expect(events).toHaveLength(2);
        expect(events[0].type).toBe('data');
        expect(events[0].data.status).toBe('Listing');
        expect(events[1].type).toBe('end');
        done();
      });
    });
  });

  describe('add', () => {
    it('should emit data and end events', (done) => {
      const sevenZip = new SevenZip();
      const stream = sevenZip.add('/path/to/archive.zip', ['/path/to/file1.txt']);
      
      const events = [];
      stream.on('data', (data) => events.push({ type: 'data', data }));
      stream.on('end', () => {
        events.push({ type: 'end' });
        expect(events).toHaveLength(2);
        expect(events[0].type).toBe('data');
        expect(events[0].data.status).toBe('Compressing');
        expect(events[1].type).toBe('end');
        done();
      });
    });
  });
});