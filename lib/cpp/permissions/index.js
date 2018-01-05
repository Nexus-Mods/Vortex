const fs = require('fs');

let win;
if (process.platform === 'win32') {
  win = require('./windows');
}

function winTranslateUser(input) {
  return {
    everyone: 'Authenticated Users',
  }[input] || input;
}

function winTranslateRight(input) {
  return {
    r: win.GENERIC_READ,
    rw: win.GENERIC_READ | win.GENERIC_WRITE,
    rx: win.GENERIC_READ | win.GENERIC_EXECUTE,
    rwx: win.GENERIC_ALL,
  }[input] || input;
}

function chmodTranslateRight(user, input) {
  let base = {
    r: 4,
    rw: 6,
    rx: 5,
    rwx: 7,
  }[input];
  return (user === 'everyone') ? base * 9 : base;
}

function allow(target, user, rights) {
  if (process.platform === 'win32') {
    win.ApplyAccess(
      target,
      win.Grant(winTranslateRight(rights), winTranslateUser(user)));
    return Promise.resolve();
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
