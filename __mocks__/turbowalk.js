'use strict';

let handlers = {
};

module.exports = {
  default: (path, cb) => {
    if (handlers[path] !== undefined) {
      handler((err, files) => {
        if (err !== null) {
          return Promise.reject(err);
        } else {
          cb(files);
          return Promise.resolve();
        }
      })
    } else {
      cb([]);
      return Promise.resolve();
    }
  },
  __setPathHandler: (path, handler) => {
    handlers[path] = handler;
  },
};
