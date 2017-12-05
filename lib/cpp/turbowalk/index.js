if (process.platform === 'win32') {
  let path = require('path');

  const turbowalk = require('./build/Release/turbowalk').default;
  // const turbowalk = require('./build/Debug/turbowalk').default;
  const bluebird = require('bluebird');

  module.exports = {
    default: (walkPath, progress, options) => new bluebird((resolve, reject) => {
      turbowalk(walkPath, progress, (err) =>
        err !== null ? reject(err) : resolve(err)
      , options || {});
    }),
  };
} else {
  // fallback: js implementation
}
