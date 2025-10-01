var webpack = require('webpack');
var nodeExternals = require('webpack-node-externals');
const TerserPlugin = require('terser-webpack-plugin')

const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

const mode = 'production';

// transpileOnly leads to type declarations not being removed from the js output
// which for some reason currently leads to starup errors
const transpileOnly = ((ForkTsCheckerWebpackPlugin !== undefined)
                    || (process.env['BUILD_QUICK_AND_DIRTY'] !== undefined))
                    && false;

const plugins = [
  new webpack.DefinePlugin({ 'process.env.NODE_ENV': JSON.stringify('production') }),
];

if ((ForkTsCheckerWebpackPlugin !== undefined) && (process.env['BUILD_QUICK_AND_DIRTY'] === undefined)) {
  plugins.push(new ForkTsCheckerWebpackPlugin());
}


module.exports = {
  entry: {
    renderer: './src/renderer.tsx',
    splash: './src/splash.ts'
  },
  target: 'electron-renderer',
  node: { __filename: false, __dirname: false },
  mode,
  output: {
    libraryTarget: 'commonjs2',
    filename: '../app/[name].js'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
        options: {
          transpileOnly,
          compilerOptions: {
            sourceMap: true,
            inlineSourceMap: false,
            inlineSources: false,
          }
        }
      },
      {
        test: /\.scss$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              sourceMap: true,
              importLoaders: 2
            }
          },
          {
            loader: 'resolve-url-loader',
            options: {
              sourceMap: true
            }
          },
          {
            loader: 'sass-loader',
            options: {
              sourceMap: true,
              sassOptions: {
                outputStyle: 'compressed'
              }
            }
          }
        ]
      },
    ]
  },
  resolve: { extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'] },
  plugins,
  optimization: {
    minimizer: [
      new TerserPlugin({
        parallel: true,
        terserOptions: {
          compress: {},
          output: {
            max_line_len: 256,
          },
          mangle: false,
          sourceMap: true,
          keep_fnames: true, // required atm, name mangling breaks extensions
        }
      })
    ]
  },
  devtool: 'source-map',
  externals: nodeExternals(),
};
