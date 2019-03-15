'use strict';

let checkResult = [];

module.exports = {
  default: () => {
    return checkResult;
  },
  __setCheckResult: (res) => {
    checkResult = res;
  },
};
