'use strict';

let checkResult = {
  '': {
    free: 42,
  },
}

module.exports = {
  check: (checkPath) => {
    return checkResult[checkPath] || checkResult[''];
  },
  __setCheckResult: (checkPath, res) => {
    checkResult[checkPath] = res;
  },
};
