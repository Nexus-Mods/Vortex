var webpack = require('webpack');

module.exports = {
    entry: './out/index.js',
    target: 'node',
    output: {
        libraryTarget: 'commonjs2',
        library: 'sample',
        filename: './dist/index.js'
    },
    module: {
        loaders: [
            { test: /\.jsx?$/, loader: 'babel-loader', exclude: /node_modules/ },
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
        'fs',
        'path',
        'net',
        'nmm-api',
        'node',
        'react',
        'react-bootstrap'
    ]
};
