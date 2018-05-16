var webpack = require('webpack');
var nodeExternals = require('webpack-node-externals');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin')

const mode = 'production';

module.exports = {
  entry: './src/renderer.tsx',
  target: 'electron-renderer',
  node: { __filename: false, __dirname: false },
  mode,
  output: {
    libraryTarget: 'commonjs2',
    filename: '../app/renderer.js'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
        options: {
          compilerOptions: {
            sourceMap: true,
            inlineSourceMap: false,
            inlineSources: false,
          }
        }
      },
    ]
  },
  resolve: { extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'] },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
    }),
  ],
  optimization: {
    minimizer: [
      new UglifyJSPlugin({
        cache: true,
        parallel: true,
        sourceMap: true,
        uglifyOptions: {
          compress: true,
          mangle: true,
          keep_fnames: true, // required atm, name mangling breaks extensions
        }
      })
    ]
  },
  devtool: 'source-map',
  externals: /*Object.assign(externals(), {
    'bindings': 'bindings',
    'crash-dump': 'crash-dump',
    'drivelist': 'drivelist',
    'edge': 'edge',
    'i18next-node-fs-backend': 'i18next-node-fs-backend',
    'icon-extract': 'icon-extract',
    'leveldown': 'leveldown',
    'node-sass': 'node-sass',
    'turbowalk': 'turbowalk',
    'vortex-run': 'vortex-run',
    'ws': 'ws',
  }),*/
  /*
  externals: ['crash-dump', 'drivelist', 'edge', 'exe-version', 'express', 'ffi', 'i18next-node-fs-backend',
              'icon-extract', 'leveldown', 'nbind', 'node-sass', 'permission', 'ref', 'semver', 'turbowalk',
              'vortex-parse-ini', 'vortex-run', 'winston', 'ws'],*/ nodeExternals(),
};
