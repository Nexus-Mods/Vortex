const fs = require("fs");
const path = require("path");
const sevenzip = require("node-7z");
const fetch = require("cross-fetch");

const QUICK_BMS_URL = "http://aluigi.altervista.org/papers/quickbms.zip";

function download(url, cb) {
  fetch(url)
    .then((res) => {
      console.log(res.status, res.statusText);
      res.arrayBuffer().then((buffer) => {
        fs.writeFile(path.basename(url), Buffer.from(buffer), cb);
      });
    })
    .catch((err) => {
      console.error("download failed", err);
    });
}

const seven = new sevenzip();
try {
  fs.statSync("dependencies");
  console.log("dependencies already installed");
} catch (err) {
  download(QUICK_BMS_URL, () => {
    seven
      .extract(path.basename(QUICK_BMS_URL), "dist", {
        raw: ["quickbms_4gb_files.exe"],
      })
      .then(() => fs.unlinkSync(path.basename(QUICK_BMS_URL)))
      .catch((err) => console.error(err));
  });
}
