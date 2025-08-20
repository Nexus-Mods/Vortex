'use strict';

class XXHash64 {
  constructor() {}
  update(data) { return this; }
  digest() { return 'mock-hash'; }
}

module.exports = {
  XXHash64,
};