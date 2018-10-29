'use strict';

var util = require('util');

let error = undefined;

module.exports = {
  ShellExecuteEx: () => {
    if (error === undefined) {
      return;
    } else {
      throw new Error(error);
    }
  },
  __setError: (err) => { error = err; },
};
