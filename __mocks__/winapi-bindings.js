'use strict';

var util = require('util');
var path = require('path');

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
  GetVolumePathName: (input) => {
    const res = path.dirname(input);
    if (res === '/missing') {
      let err = new Error('fake error');
      err.code = 'ENOTFOUND';
      err.systemCode = 2;
      throw err;
    }
    return res;
  },
  __setError: (err) => { error = err; },
};
