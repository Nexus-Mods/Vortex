'use strict';

var util = require('util');

let error = undefined;

module.exports = {
  Library: (name, exp) => {
    let result = {};
    let keys = Object.keys(exp);
    for (var i = 0; i < keys.length; ++i) {
      result[keys[i]] = {
        async: (par, callback) => {
          if (error) {
            callback(error);
          } else {
            callback(null, 0);
          }
        }
      };
    }
    return result;
  },
  __setError: (err) => { error = err; },
};

