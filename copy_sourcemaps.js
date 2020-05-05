const copyfiles = require('copyfiles');
const fs = require('fs');

const pack = JSON.parse(fs.readFileSync('package.json'));

copyfiles(['app/**/*.js.map', 'app/**/*.js', `sourcemaps/${pack.version}`], { up: 1 }, () => {
  console.log('done');
});
