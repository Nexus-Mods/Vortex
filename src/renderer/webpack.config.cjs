const webpack = require("webpack");
const nodeExternals = require("webpack-node-externals");
const TerserPlugin = require("terser-webpack-plugin");
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");
const path = require("node:path");

const mode = process.env.NODE_ENV === "production" ? "production" : "development";

// HMR build used by `pnpm dev` (scripts/dev.mjs). The window keeps loading
// file://index.html and the bundle stays a CommonJS module require()'d from
// disk; hot-update chunks are likewise require()'d from the build directory,
// so no dev server and no CSP change is involved.
const hmr = mode === "development" && process.env.VORTEX_HMR === "1";

const plugins = [new ForkTsCheckerWebpackPlugin()];

if (hmr) {
    const ReactRefreshWebpackPlugin = require("@pmmmwh/react-refresh-webpack-plugin");
    plugins.push(
        new webpack.HotModuleReplacementPlugin(),
        // overlay needs a dev-server socket; updates arrive via the poll
        // client in tools/hmr-client.cjs instead
        new ReactRefreshWebpackPlugin({ overlay: false }),
        {
            // readiness/progress sentinel parsed by scripts/dev.mjs
            apply: (compiler) => {
                compiler.hooks.done.tap("VortexHmrSignal", (stats) => {
                    if (!stats.hasErrors()) {
                        console.log(`[vortex-hmr] compiled ${stats.hash}`);
                    }
                });
            },
        },
    );
}

const optimizer = new TerserPlugin({
    parallel: true,
    terserOptions: {
        mangle: false,
        sourceMap: true,
        keep_fnames: true,
    },
});

const tsLoader = {
    loader: "ts-loader",
    options: {
        configFile: path.resolve(__dirname, "tsconfig.json"),
        compilerOptions: {
            composite: false,
            sourceMap: true,
            inlineSourceMap: false,
            inlineSources: false,
        },
        // ForkTsCheckerWebpackPlugin still typechecks; skipping it in the
        // loader keeps hot rebuilds fast
        ...(hmr ? { transpileOnly: true } : {}),
    },
};

// react-refresh needs its babel transform; run it on ts-loader's output.
// babelrc/configFile off so the test-only .babelrc doesn't apply.
const refreshLoader = {
    loader: "babel-loader",
    options: {
        babelrc: false,
        configFile: false,
        plugins: [require.resolve("react-refresh/babel")],
    },
};

/**
 * @type {webpack.Configuration}
 * */
const config = {
    mode,
    entry: {
        renderer: hmr
            ? [
                  path.resolve(__dirname, "tools", "hmr-client.cjs"),
                  path.resolve(__dirname, "src", "renderer.tsx"),
              ]
            : path.resolve(__dirname, "src", "renderer.tsx"),
        splash: path.resolve(__dirname, "src", "splash.ts"),
    },
    target: "electron-renderer",
    output: {
        libraryTarget: "commonjs2",
        filename: "[name].js",
        path: path.resolve(__dirname, "..", "main", "build"),
        // load hot-update chunks through node's require() relative to the
        // bundle on disk (CSP-exempt, no server), like a target:"node" build
        ...(hmr ? { chunkFormat: "commonjs", chunkLoading: "require" } : {}),
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
                exclude: /node_modules/,
                use: hmr ? [refreshLoader, tsLoader] : [tsLoader],
            },
        ],
    },
    optimization: {
        minimizer: mode === "development" ? [] : [optimizer],
    },
    // NOTE(erri120): can't use eval source maps due to CSP.
    // Use full source-map for accurate breakpoint support in VSCode.
    devtool: "source-map",
    externals: [nodeExternals()],
};

module.exports = config;
