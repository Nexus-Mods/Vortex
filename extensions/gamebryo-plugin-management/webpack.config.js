const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: './src/index.ts',
  target: 'electron-renderer',
  node: { __filename: false, __dirname: false },
  output: {
    libraryTarget: 'commonjs2',
    library: 'gamebryo-plugin-management',
    filename: 'index.js',
    sourceMapFilename: 'gamebryo-plugins.js.map',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    loaders: [
      { test: /\.tsx?$/, loader: 'ts-loader' },
      { test: /\.json$/, loader: 'json-loader' },
    ]
  },
  resolve: { extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'] },
  plugins: [],
  devtool: 'source-map',
  externals: [
    'bluebird',
    'fs',
    'fs-extra-promise',
    'iconv-lite', 
    'immutability-helper',
    'lodash',
    'net',
    'vortex-api',
    'node',
    'nbind',
    'path',
    'react',
    'react-act',
    'react-bootstrap',
    'react-dom',
    'react-dnd',
    'react-dnd-html5-backend',
    'react-i18next',
    'react-layout-pane',
    'react-redux',
    'react-select',
    'util'
  ]
};
