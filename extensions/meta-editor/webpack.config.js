var webpack = require('webpack');

module.exports = {
    entry: './out/index.js',
    target: 'electron-renderer',
    node: { __filename: false, __dirname: false },
    output: {
        libraryTarget: 'commonjs2',
        library: 'meta_editor',
        filename: './dist/index.js'
    },
    module: {
        loaders: [
            { test: /\.json?$/, loader: 'json-loader' },
        ]
    },
    resolve: {
        extensions: ['', '.js', '.jsx', '.json']
    },
    _plugins: [
        new webpack.optimize.UglifyJsPlugin({
            compress: { warnings: false },
            comments: false,
            sourceMap: false
        })
    ],
    externals: [
        'bluebird',
        'fs',
        'immutability-helper',
        'modmeta-db',
        'net',
        'vortex-api',
        'node',
        'path',
        'react',
        'react-bootstrap',
        'react-i18next',
        'react-redux',
        'url'
    ]
};
