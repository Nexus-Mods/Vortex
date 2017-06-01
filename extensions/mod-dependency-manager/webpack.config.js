var webpack = require('webpack');

module.exports = {
  entry: './out/index.js',
  target: 'electron-renderer',
  node: { __filename: false, __dirname: false },
  output: {
    libraryTarget: 'commonjs2',
    library: 'mod-dependency-manager',
    filename: './dist/index.js'
  },
  module: {
    loaders: [
      { test: /\.json?$/, loader: 'json-loader' }
    ]
  },
  resolve: { extensions: ['', '.js', '.jsx', '.json'] },
  _plugins: [
    new webpack.optimize.UglifyJsPlugin(
        { compress: { warnings: false }, comments: false, sourceMap: false })
  ],
  externals: [
    'bluebird',
    'ffi',
    'fs',
    'fs-extra-promise',
    'immutability-helper',
    'path',
    'net',
    'nmm-api',
    'node',
    'nbind',
    'react',
    'react-act',
    'react-bootstrap',
    'react-dom',
    'react-i18next',
    'react-layout-pane',
    'react-redux',
    'ref',
    'semvish',
    'util'
  ]
};
