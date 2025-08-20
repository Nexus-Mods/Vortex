'use strict';

class MockIterator {
  constructor() {
    this._data = new Map();
    this._ended = false;
  }

  seek(target) {
    return this;
  }

  end(callback) {
    this._ended = true;
    process.nextTick(() => callback());
  }

  next(callback) {
    process.nextTick(() => callback(null, null, null));
  }
}

class MockLevelDOWN {
  constructor(location) {
    this.location = location;
    this.status = 'new';
    this.data = new Map();
  }

  open(options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    this.status = 'open';
    process.nextTick(() => callback());
  }

  close(callback) {
    this.status = 'closed';
    process.nextTick(() => callback());
  }

  put(key, value, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    this.data.set(key, value);
    process.nextTick(() => callback());
  }

  get(key, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    const value = this.data.get(key);
    process.nextTick(() => {
      if (value === undefined) {
        callback(new Error('NotFound'));
      } else {
        callback(null, value);
      }
    });
  }

  del(key, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    this.data.delete(key);
    process.nextTick(() => callback());
  }

  batch(operations, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    operations.forEach(op => {
      if (op.type === 'put') {
        this.data.set(op.key, op.value);
      } else if (op.type === 'del') {
        this.data.delete(op.key);
      }
    });
    process.nextTick(() => callback());
  }

  iterator(options) {
    return new MockIterator();
  }
}

MockLevelDOWN.destroy = function(location, callback) {
  process.nextTick(() => callback());
};

module.exports = function(location) {
  return new MockLevelDOWN(location);
};

module.exports.MockLevelDOWN = MockLevelDOWN;