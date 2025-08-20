'use strict';

module.exports = {
  getFileVersionInfo: () => Promise.resolve({
    fileVersion: '0.0.0.0',
    productVersion: '0.0.0.0',
    companyName: 'Mock Company',
    fileDescription: 'Mock Description',
    productName: 'Mock Product',
    originalFilename: 'Mock.exe'
  })
};