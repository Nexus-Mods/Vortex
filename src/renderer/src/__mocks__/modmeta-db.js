'use strict';

module.exports = {
  genHash: () => {
    console.log('call genHash');
    return Promise.resolve({ md5sum: 'fake hash' });
  },
}
