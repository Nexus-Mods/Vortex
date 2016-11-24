'use strict';

function struct(desc) {
  this.ref = () => undefined;
}

struct.size = 0;

module.exports = () => struct;
