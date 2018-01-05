const webpack = require('vortex-api').webpack.default;

const config = webpack('usvfs-deployment', __dirname);
config.externals.iconv = 'iconv-lite';

module.exports = config;
