function getVersion(filePath) {
  if (process.platform === 'win32') {
    return require('./build/Release/ExeVersion').getVersion(filePath);
  }
  // not implemented on MacOS and Linux. On MacOS we could use the bundle version
  // from the plist file. On Linux? Hmm
  return '';
}

module.exports.default = getVersion;

