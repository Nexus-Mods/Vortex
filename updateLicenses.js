let fs = require("fs");
let checker = require("license-checker");
let path = require("path");

let basePath = path.join(__dirname, ".");

checker.init(
  {
    start: basePath,
    customPath: "./licenseFormat.json",
    production: true,
    //relativeLicensePath: true,
  },

  function (err, json) {
    if (err) {
      return console.error("error", err);
    }

    const deleteKeys = ["vortex-api", "vortex"];

    Object.keys(json).forEach((key) => {
      if (
        key.startsWith("@types") ||
        (json[key].publisher !== undefined &&
          json[key].publisher.startsWith("Black Tree Gaming"))
      ) {
        deleteKeys.push(key);
        return;
      }

      // make the license path relative. license-checker has an option
      // to do that for us but that causes errors
      if (json[key].licenseFile) {
        json[key].licenseFile = path
          .relative(basePath, json[key].licenseFile)
          .split(path.sep);
      }

      delete json[key].path;
    });

    deleteKeys.forEach((key) => delete json[key]);

    console.log(`Writing ${Object.keys(json).length} modules`);

    fs.writeFile(
      path.join("assets", "modules.json"),
      JSON.stringify(json, undefined, 2),
      { encoding: "utf-8" },
      () => null,
    );
  },
);
