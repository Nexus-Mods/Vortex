var webpack = require('webpack');

module.exports = {
  entry: './out/index.js',
  target: 'electron-renderer',
  node: { __filename: false, __dirname: false },
  output: {
    libraryTarget: 'commonjs2',
    library: 'sample',
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
  externals: [
    'bluebird',
    'fs',
    'fs-extra-promise',
    'path',
    'net',
    'nmm-api',
    'node',
    'nbind',
    'react',
    'react-act',
    'react-addons-update',
    'react-bootstrap',
    'react-i18next',
    'react-layout-pane',
    'react-redux',
    'util'
  ]
};
