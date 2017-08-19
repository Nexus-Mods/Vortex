var webpack = require('webpack');

module.exports = {
  entry: './out/index.js',
  target: 'electron-renderer',
  node: { __filename: false, __dirname: false },
  output: {
    libraryTarget: 'commonjs2',
    library: 'gameinfo-steam',
    filename: './dist/index.js'
  },
  module: {
    loaders: [
      { test: /\.jsx?$/, loader: 'babel-loader', exclude: /node_modules/ },
      { test: /\.json?$/, loader: 'json-loader' },
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx', '.json']
  },
  externals: [
    'bluebird',
    'ffi',
    'fs',
    'fs-extra-promise',
    'immutability-helper',
    'lodash',
    'nbind',
    'net',
    'vortex-api',
    'node',
    'path',
    'react',
    'react-act',
    'react-bootstrap',
    'react-dom',
    'react-i18next',
    'react-layout-pane',
    'react-redux',
    'ref',
    'request',
    'util'
  ]
};
