'use strict';

function Struct(desc) {
  this.ref = () => undefined;
}

Struct.size = 0;

module.exports = () => Struct;
