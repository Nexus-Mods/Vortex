var nodeExternals = require('webpack-node-externals');
const TerserPlugin = require('terser-webpack-plugin');

const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

const transpileOnly = (ForkTsCheckerWebpackPlugin !== undefined)
                    || (process.env['BUILD_QUICK_AND_DIRTY'] !== undefined);

const plugins = [];

if ((ForkTsCheckerWebpackPlugin !== undefined) && (process.env['BUILD_QUICK_AND_DIRTY'] === undefined)) {
  plugins.push(new ForkTsCheckerWebpackPlugin());
}

module.exports = {
  node: { __filename: false, __dirname: false },
  mode: 'production',
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
    ]
  },
  resolve: { extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'] },
  plugins,
  optimization: {
    minimizer: [
      new TerserPlugin({
        cache: true,
        parallel: true,
        sourceMap: true,
        terserOptions: {
          compress: {},
          output: {
            max_line_len: 256,
          },
          mangle: false,
          keep_fnames: true, // required atm, name mangling breaks extensions
        }
      })
    ]
  },
  devtool: 'source-map',
  externals: nodeExternals(),
};
