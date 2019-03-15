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
  RegGetValue: () => {
    return {
      type: 'REG_SZ',
      value: 'foobar',
    };
  },
  __setError: (err) => { error = err; },
};
