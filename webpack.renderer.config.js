var webpack = require("webpack");
var nodeExternals = require("webpack-node-externals");
const TerserPlugin = require("terser-webpack-plugin");
const path = require("path");
const ReactRefreshWebpackPlugin = require("@pmmmwh/react-refresh-webpack-plugin");
const ReactRefreshTypeScript = require("react-refresh-typescript");

module.exports = (env, argv) => {
  const mode = argv.mode;
  const isDev = mode === "development";

  /** @type {import("webpack").Configuration} */
  const config = {
    entry: {
      renderer: "./src/renderer.tsx",
      splash: "./src/splash.ts",
    },
    target: "electron-renderer",
    node: { __filename: false, __dirname: false },
    mode,
    output: {
      libraryTarget: "commonjs2",
      filename: isDev ? "[name].js" : "../app/[name].js",
      publicPath: isDev ? "http://localhost:3000" : undefined,
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          loader: "ts-loader",
          exclude: /node_modules/,
          options: {
            transpileOnly: isDev, // needed for React Refresh
            getCustomTransformers: () => ({
              before: [...(isDev ? [ReactRefreshTypeScript()] : [])],
            }),
            compilerOptions: {
              sourceMap: true,
              inlineSourceMap: false,
              inlineSources: false,
            },
          },
        },
      ],
    },
    plugins: [...(isDev ? [new ReactRefreshWebpackPlugin()] : [])],
    resolve: { extensions: [".js", ".jsx", ".ts", ".tsx", ".json"] },
    optimization: isDev
      ? { emitOnErrors: false }
      : {
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
              },
            }),
          ],
        },
    devtool: "source-map",
    externals: [
      nodeExternals(),
      // Explicitly exclude local file: dependencies that must remain external
      "fomod-installer-ipc",
      "fomod-installer-native",
    ],
    devServer: isDev
      ? {
          port: 3000,
          hot: true,
          liveReload: false,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
          watchFiles: ["src/**/*.{ts,tsx}"],
          static: {
            directory: path.join(__dirname, "out"),
            publicPath: "/",
          },
        }
      : undefined,
  };

  return config;
};
