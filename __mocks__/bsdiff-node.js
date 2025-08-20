module.exports = {
  diff: (oldFile, newFile, patchFile) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve();
      }, 100);
    });
  },
  patch: (oldFile, newFile, patchFile) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve();
      }, 100);
    });
  }
};