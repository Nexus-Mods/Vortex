// little hack to import font-manager in deployed state. There is
// probably a better way to do this...

let fontManager = require('./font-manager');
if (fontManager === undefined) {
  fontManager = require('font-manager');
}

module.exports = fontManager;
