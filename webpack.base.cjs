const webpack = require("webpack");
const nodeExternals = require("webpack-node-externals");
const TerserPlugin = require("terser-webpack-plugin");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");
const path = require("node:path");

const mode =
    process.env.NODE_ENV === "production" ? "production" : "development";

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
 * @param {webpack.EntryObject} entry
 * @param {string} target
 * @param {string} tsconfig
 * @returns {webpack.Configuration}
 * */
function createConfig(entry, target, tsconfig) {
    return {
        entry: entry,
        target: target,
        output: {
            libraryTarget: "commonjs2",
            filename: "[name].js",
            path: path.resolve(
                __dirname,
                "src",
                "main",
                mode === "production" ? "dist" : "out",
            ),
        },
        plugins: plugins,
        resolve: {
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
                        configFile: tsconfig,
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
            // Explicitly exclude local file: dependencies that must remain external
            "fomod-installer-ipc",
            "fomod-installer-native",
        ],
    };
}

module.exports = createConfig;
