const fs = require('fs');
const path = require('path');

let winAcl;
if (process.platform === 'win32') {
  winAcl = require('nbind').init(path.join(__dirname)).lib;
}

function chmodTranslateRight(user, input) {
  let base = [
    ['x', 1],
    ['w', 2],
    ['r', 4]
  ].reduce((prev, perm) => input.indexOf(perm[0]) !== -1 ? prev + perm[2] : prev);

  switch (user) {
    case 'everyone': return base * 73; // 7 -> 0777
    case 'owner': return base * 64;    // 7 -> 0700
    case 'group': return base * 8;     // 7 -> 0070
    case 'guest': return base;         // 7 -> 0007
    default: return 0;    // 0
  }
}

function allow(target, user, rights) {
  if (process.platform === 'win32') {
    try {
      winAcl.apply(winAcl.Access.grant(user, rights), target);
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  } else {
    return new Promise((resolve, reject) => {
      fs.stat(target, (statErr, stats) => {
        if (statErr !== null) {
          reject(statErr);
        } else {
          fs.chmod(target, stats.mode | chmodTranslateRight(user, mode), chmodErr => {
            return chmodErr !== null
              ? reject(chmodErr)
              : resolve();
          });
        }
      });
    });
  }
}

module.exports = {
  allow
};
