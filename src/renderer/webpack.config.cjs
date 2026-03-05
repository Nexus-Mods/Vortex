const webpack = require("webpack");
const nodeExternals = require("webpack-node-externals");
const TerserPlugin = require("terser-webpack-plugin");
const path = require("path");

const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

const mode =
    process.env.NODE_ENV === "production" ? "production" : "development";

const plugins = [
    new webpack.DefinePlugin({
        "process.env.NODE_ENV": JSON.stringify(mode),
    }),
    new ForkTsCheckerWebpackPlugin(),
];

module.exports = {
    entry: {
        renderer: "./renderer.tsx",
        splash: "./splash.ts",
    },
    target: "electron-renderer",
    node: { __filename: false, __dirname: false },
    mode,
    output: {
        libraryTarget: "commonjs2",
        filename: "[name].js",
        path: path.resolve(
            __dirname,
            "..",
            "main",
            mode === "production" ? "dist" : "out",
        ),
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: "ts-loader",
                exclude: /node_modules/,
                options: {
                    configFile: "./tsconfig.json",
                    compilerOptions: {
                        composite: false,
                        sourceMap: true,
                        inlineSourceMap: false,
                        inlineSources: false,
                    },
                },
            },
        ],
    },
    resolve: {
        extensions: [".js", ".jsx", ".ts", ".tsx", ".json"],
    },
    plugins,
    optimization: {
        minimizer:
            mode === "development"
                ? []
                : [
                      new TerserPlugin({
                          parallel: true,
                          terserOptions: {
                              compress: {},
                              output: {
                                  max_line_len: 256,
                              },
                              mangle: false,
                              sourceMap: true,
                              keep_fnames: true,
                          },
                      }),
                  ],
    },
    devtool: mode === "development" ? "eval-source-map" : "source-map",
    externals: [
        nodeExternals(),
        // Explicitly exclude local file: dependencies that must remain external
        "fomod-installer-ipc",
        "fomod-installer-native",
    ],
};
