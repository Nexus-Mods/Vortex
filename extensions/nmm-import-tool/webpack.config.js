var webpack = require('webpack');

module.exports = {
  entry: './out/index.js',
  target: 'electron-renderer',
  node: { __filename: false, __dirname: false },
  output: {
    libraryTarget: 'commonjs2',
    library: 'nmm-import-tool',
    filename: './dist/index.js'
  },
  module: {
    loaders: [
      { test: /\.json?$/, loader: 'json-loader' },
    ]
  },
  resolve: { extensions: ['', '.js', '.jsx', '.json'] },
  plugins: [],
  devtool: 'source-map',
  externals: [
    'bluebird',
    'fs',
    'fs-extra-promise',
    'immutability-helper',
    'lodash',
    'modmeta-db',
    'net',
    'vortex-api',
    'node',
    'nbind',
    'path',
    'react',
    'react-act',
    'react-bootstrap',
    'react-dom',
    'react-i18next',
    'react-layout-pane',
    'react-redux',
    'util'
  ]
};
