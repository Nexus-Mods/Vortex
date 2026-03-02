var webpack = require("webpack");
var nodeExternals = require("webpack-node-externals");
const TerserPlugin = require("terser-webpack-plugin");
const path = require("path");

const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

const mode = "production";

// transpileOnly leads to type declarations not being removed from the js output
// which for some reason currently leads to starup errors
const transpileOnly =
    (ForkTsCheckerWebpackPlugin !== undefined ||
        process.env["BUILD_QUICK_AND_DIRTY"] !== undefined) &&
    false;

const plugins = [
    new webpack.DefinePlugin({
        "process.env.NODE_ENV": JSON.stringify("production"),
    }),
];

if (
    ForkTsCheckerWebpackPlugin !== undefined &&
    process.env["BUILD_QUICK_AND_DIRTY"] === undefined
) {
    plugins.push(new ForkTsCheckerWebpackPlugin());
}

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
        path: path.resolve(__dirname, "..", "main", "dist"),
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: "ts-loader",
                exclude: /node_modules/,
                options: {
                    configFile: "./tsconfig.json",
                    transpileOnly,
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
};
