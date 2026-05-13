const webpack = require("webpack");
const nodeExternals = require("webpack-node-externals");
const TerserPlugin = require("terser-webpack-plugin");
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");
const path = require("node:path");

const mode = process.env.NODE_ENV === "production" ? "production" : "development";

const plugins = [
    new webpack.DefinePlugin({
        "process.env.NODE_ENV": JSON.stringify(mode),
    }),
    new ForkTsCheckerWebpackPlugin(),
];

const optimizer = new TerserPlugin({
    parallel: true,
    terserOptions: {
        mangle: false,
        sourceMap: true,
        keep_fnames: true,
    },
});

/**
 * @type {webpack.Configuration}
 * */
const config = {
    entry: {
        renderer: path.resolve(__dirname, "src", "renderer.tsx"),
        splash: path.resolve(__dirname, "src", "splash.ts"),
    },
    target: "electron-renderer",
    output: {
        libraryTarget: "commonjs2",
        filename: "[name].js",
        path: path.resolve(__dirname, "..", "main", mode === "production" ? "dist" : "out"),
    },
    plugins: plugins,
    resolve: {
        plugins: [new TsconfigPathsPlugin()],
        extensions: [".js", ".jsx", ".ts", ".tsx", ".json"],
    },
    // NOTE(erri120): disable polyfills for browser because nodeIntegration is enabled
    node: { __filename: false, __dirname: false },
    module: {
        rules: [
            {
                test: /\.[cm]?js$/,
                include: path.resolve(__dirname, "src", "shared", "dist"),
                enforce: "pre",
                use: ["source-map-loader"],
            },
            {
                test: /\.tsx?$/,
                loader: "ts-loader",
                exclude: /node_modules/,
                options: {
                    configFile: path.resolve(__dirname, "tsconfig.json"),
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
    optimization: {
        minimizer: mode === "development" ? [] : [optimizer],
    },
    // NOTE(erri120): can't use eval source maps due to CSP.
    // Use full source-map for accurate breakpoint support in VSCode.
    devtool: "source-map",
    externals: [
        nodeExternals({
            allowlist: [/@vortex\/shared/],
        }),
    ],
};

module.exports = config;
