var webpack = require('webpack');

module.exports = {
  entry: './src/index.tsx',
  target: 'electron-renderer',
  node: { __filename: false, __dirname: false },
  output: {
    libraryTarget: 'commonjs2',
    library: 'feedback',
    filename: './dist/index.js',
    sourceMapFilename: './dist/feedback.js.map',
  },
  module: {
    loaders: [
      { test: /\.tsx?$/, loader: 'ts-loader' },
      { test: /\.json$/, loader: 'json-loader' },
    ]
  },
  resolve: { extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'] },
  devtool: 'source-map',
  externals: [
    'bluebird',
    'ffi',
    'fs',
    'fs-extra-promise',
    'immutability-helper',
    'path',
    'net',
    'vortex-api',
    'node',
    'nbind',
    'react',
    'react-act',
    'react-bootstrap',
    'react-i18next',
    'react-layout-pane',
    'react-redux',
    'ref',
    'util'
  ]
};
