// Central stub for original-fs to avoid electron-only API during builds
// Maps to Node's fs for bundling-time compatibility
module.exports = require('fs');