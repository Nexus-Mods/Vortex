'use strict';

var util = require('util');

let error = undefined;

module.exports = {
  Library: (name, exp) => {
    let result = {};
    let keys = Object.keys(exp);
    for (var i = 0; i < keys.length; ++i) {
      result[keys[i]] = {
        async: (...args) => {
          const callback = args[args.length - 1];
          if (error) {
            return callback(new Error(error));
          }
          return callback(null, 42);
        }
      };
    }
    return result;
  },
  __setError: (err) => { error = err; },
};

