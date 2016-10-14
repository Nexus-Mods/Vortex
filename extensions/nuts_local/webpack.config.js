var webpack = require('webpack')

module.exports = {
    entry: './main.js',
    target: 'node',
    output: {
        libraryTarget: 'commonjs2',
        library: 'nuts-local',
        filename: 'index.js'
    },
    module: {
        loaders: [
            { test: /\.jsx?$/, loader: 'babel-loader', exclude: /node_modules/ },
            { test: /\.json?$/, loader: 'json-loader' },
        ]
    },
    resolve: {
        extensions: ['', '.js', '.jsx', '.ts', '.tsx', '.json']
    },
    plugins: [
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
        'node',
        '../../util/log'
    ]
};
