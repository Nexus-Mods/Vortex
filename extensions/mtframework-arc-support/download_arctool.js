const fs = require("fs");
const http = require("http");
const sevenzip = require("node-7z");
const path = require("path");

function download(url, outpath, callback) {
  const stream = fs.createWriteStream(outpath);
  const request = http
    .get(url, (response) => {
      response.pipe(stream);
      stream.on("finish", (response) => {
        stream.close(callback);
      });
    })
    .on("error", (err) => {
      fs.unlink(outpath, () => {
        if (callback) {
          callback(err);
        }
      });
    });
}

try {
  fs.mkdirSync("dl");
} catch (err) {
  if (err.code !== "EEXIST") {
    throw err;
  }
}
const dlPath = path.join("dl", "ARCtool.rar");
fs.stat(dlPath, (err) => {
  const extract = () => {
    const seven = new sevenzip();
    seven.extract(dlPath, "dist", { raw: ["ARCtool.exe"] });
  };

  if (err) {
    download(
      "http://www.fluffyquack.com/tools/ARCtool.rar",
      dlPath,
      (error) => {
        if (error) {
          console.error(error.message);
          return;
        }
        extract();
      },
    );
  } else {
    extract();
  }
});
