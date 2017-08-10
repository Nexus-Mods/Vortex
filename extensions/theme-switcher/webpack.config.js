var webpack = require('webpack');

module.exports = {
  entry: './out/index.js',
  target: 'electron-renderer',
  node: { __filename: false, __dirname: false },
  output: {
    libraryTarget: 'commonjs2',
    library: 'theme-switcher',
    filename: './dist/index.js'
  },
  module: {
    loaders: [
      { test: /\.json?$/, loader: 'json-loader' },
    ]
  },
  resolve: { extensions: ['', '.js', '.jsx', '.json'] },
  _plugins: [
    new webpack.optimize.UglifyJsPlugin(
        { compress: { warnings: false }, comments: false, sourceMap: false })
  ],
  devtool: 'source-map',
  externals: {
    bluebird: 'bluebird',
    ffi: 'ffi',
    'font-manager': './fontmanager',
    fs: 'fs',
    'fs-extra-promise': 'fs-extra-promise',
    'immutability-helper': 'immutability-helper',
    path: 'path',
    net: 'net',
    'vortex-api': 'vortex-api',
    node: 'node',
    nbind: 'nbind',
    react: 'react',
    'react-act': 'react-act',
    'react-bootstrap': 'react-bootstrap',
    'react-i18next': 'react-i18next',
    'react-layout-pane': 'react-layout-pane',
    'react-redux': 'react-redux',
    ref: 'ref',
    util: 'util'
  }
};
