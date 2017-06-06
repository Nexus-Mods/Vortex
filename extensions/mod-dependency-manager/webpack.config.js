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
    'lodash',
    'minimatch',
    'modmeta-db',
    'net',
    'nmm-api',
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
    'ref',
    'semver',
    'semvish',
    'util'
  ]
};
