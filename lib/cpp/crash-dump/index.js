function init(dmpPath) {
  if (process.platform === 'win32') {
    let windump = require('./build/Release/windump');
    windump.init(dmpPath);
  } // not implemented on other platforms yet
}

module.exports = {
  default: init,
}
