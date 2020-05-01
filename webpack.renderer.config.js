module.exports = require('webpack-merge')(require('./webpack.base.config'), {
  entry: './src/renderer.tsx',
  target: 'electron-renderer',
  output: {
    libraryTarget: 'commonjs2',
    filename: '../app/renderer.js'
  }
});
