module.exports = require('webpack-merge')(require('./webpack.base.config'), {
  entry: './src/main.ts',
  target: 'electron-main',
  output: {
    libraryTarget: 'commonjs2',
    filename: '../app/main.js'
  }
});
