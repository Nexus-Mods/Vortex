'use strict';

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

class Mock7z {
  constructor(pathTo7zip) {
    this.options = {};
    this.pathTo7zip = pathTo7zip;
  }

  extractFull(archivePath, destPath, options = {}) {
    const stream = new Stream();
    process.nextTick(() => {
      stream.emit('data', { status: 'Extracting', file: 'mock.txt' });
      stream.emit('progress', { percent: 100 });
      stream.emit('end');
    });
    return stream;
  }

  list(archivePath, options = {}) {
    const stream = new Stream();
    const mockFiles = [
      {
        date: new Date(),
        attr: '-rw-r--r--',
        size: 1024,
        name: 'mock.txt',
      },
      {
        date: new Date(),
        attr: 'drwxr-xr-x',
        size: 0,
        name: 'mockdir/',
      },
    ];

    process.nextTick(() => {
      mockFiles.forEach(file => stream.emit('data', file));
      stream.emit('end');
    });

    stream.promise = () => Promise.resolve(mockFiles);
    return stream;
  }

  add(archivePath, files, options = {}) {
    const stream = new Stream();
    process.nextTick(() => {
      stream.emit('data', { status: 'Compressing', file: 'mock.txt' });
      stream.emit('progress', { percent: 100 });
      stream.emit('end');
    });
    return stream;
  }

  update(archivePath, files, options = {}) {
    const stream = new Stream();
    process.nextTick(() => {
      stream.emit('data', { status: 'Updating', file: 'mock.txt' });
      stream.emit('progress', { percent: 100 });
      stream.emit('end');
    });
    return stream;
  }

  delete(archivePath, files, options = {}) {
    const stream = new Stream();
    process.nextTick(() => {
      stream.emit('data', { status: 'Deleting', file: 'mock.txt' });
      stream.emit('progress', { percent: 100 });
      stream.emit('end');
    });
    return stream;
  }

  test(archivePath, options = {}) {
    const stream = new Stream();
    process.nextTick(() => {
      stream.emit('data', { status: 'Testing', file: 'mock.txt' });
      stream.emit('progress', { percent: 100 });
      stream.emit('end');
    });
    return stream;
  }
}

module.exports = {
  __esModule: true,
  default: Mock7z
};