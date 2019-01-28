'use strict';

let checkResult = {
  free: 42,
}

module.exports = {
  check: () => {
    return checkResult;
  },
  __setCheckResult: (res) => {
    checkResult = res;
  },
};
