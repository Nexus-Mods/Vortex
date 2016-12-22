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
      { test: /\.jsx?$/, loader: 'babel-loader', exclude: /node_modules/ },
      { test: /\.json?$/, loader: 'json-loader' },
    ]
  },
  resolve: {
    extensions: ['', '.js', '.jsx', '.json']
  },
  plugins: [
    new webpack.optimize.UglifyJsPlugin({
      compress: { warnings: false },
      comments: false,
      sourceMap: false
    })
  ],
  externals: [
    'bluebird',
    'fs',
    'fs-extra-promise',
    'path',
    'nbind',
    'net',
    'nmm-api',
    'node',
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
