const copyfiles = require("copyfiles");
const fs = require("fs");
const path = require("path");

const pack = JSON.parse(fs.readFileSync(path.join("app", "package.json")));

copyfiles(
  ["app/**/*.js.map", "app/**/*.js", `sourcemaps/${pack.version}`],
  { up: 1 },
  () => {
    console.log("done");
  },
);
