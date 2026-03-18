'use strict';

module.exports = {
  types: {
    void: { size: 0, indirection: 1 }
  },
  refType: (type) => type !== undefined ? type.toString() : '',
  coerceType: (type) => type,
  alloc: (type) => ({ size: 0 }),
};
