'use strict';

let handlers = {
};

module.exports = {
  __esModule: true,
  default: (path, cb) => {
    return new Promise((resolve, reject) => {
      if (handlers[path] !== undefined) {
        handlers[path]((err, files) => {
          if (err !== null) {
            reject(err);
          } else {
            cb(files);
            resolve();
          }
        })
      } else {
        cb([]);
        resolve();
      }
    });
  },
  __setPathHandler: (path, handler) => {
    handlers[path] = handler;
  },
};
