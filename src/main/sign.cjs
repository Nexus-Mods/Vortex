const path = require("path");
const fs = require("fs");
const childProcess = require("child_process");
const crypto = require("crypto");
require("dotenv").config();

const TEMP_DIR = path.join(__dirname, "temp");
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");
const CODE_SIGN_TOOL_DIR = path.join(PROJECT_ROOT, "CodeSignTool");

// These were being incorrectly flagged by esigner as malware
// We don't need to resign MS redist files
// Make sure these are lowercase
const ignoreFileList = ["arctool.exe", "vc_redist.x64.exe", "windowsdesktop-runtime-win-x64.exe"];

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

async function sign(configuration) {
    // credentials from ssl.com
    const ES_USERNAME = process.env.ES_USERNAME;
    const ES_PASSWORD = process.env.ES_PASSWORD;
    const ES_CREDENTIAL_ID = process.env.ES_CREDENTIAL_ID;
    const ES_TOTP_SECRET = process.env.ES_TOTP_SECRET;

    if (ignoreFileList.includes(path.basename(configuration.path.toLowerCase()))) {
        console.log(`Ignoring ${configuration.path} as the file is in the ignore list`);
        return;
    }

    if (ES_USERNAME && ES_PASSWORD && ES_TOTP_SECRET && ES_CREDENTIAL_ID) {
        console.log(`Signing ${configuration.path}`);

        const { base, dir } = path.parse(configuration.path);

        // CodeSignTool can't sign in place without verifying the overwrite with a
        // y/m interaction so we are creating a new file in a temp directory and
        // then replacing the original file with the signed file.

        // The output directory is derived from the full source path rather than
        // shared, because basenames are not unique across the packaged tree
        // (e.g. several copies of AccessControl.dll and watcher.node). A shared
        // directory would let concurrent signings overwrite each other's output.
        const outDir = path.join(
            TEMP_DIR,
            crypto.createHash("sha1").update(configuration.path).digest("hex").slice(0, 12),
        );
        fs.mkdirSync(outDir, { recursive: true });
        const tempFile = path.join(outDir, base);

        try {
            const setDir = `cd "${CODE_SIGN_TOOL_DIR}"`;
            const signFile = `CodeSignTool sign -input_file_path="${configuration.path}" -output_dir_path="${outDir}" -credential_id="${ES_CREDENTIAL_ID}" -username="${ES_USERNAME}" -password="${ES_PASSWORD}" -totp_secret="${ES_TOTP_SECRET}"`;
            const moveFile = `move /Y "${tempFile}" "${dir}"`;

            childProcess.execSync(`${setDir} && ${signFile} && ${moveFile}`, {
                stdio: "inherit",
            });
        } finally {
            fs.rmSync(outDir, { recursive: true, force: true });
        }
    } else {
        console.warn(`sign.js - Can't sign file ${configuration.path}, missing value for:
        ${ES_USERNAME ? "" : "ES_USERNAME"}
        ${ES_PASSWORD ? "" : "ES_PASSWORD"}
        ${ES_CREDENTIAL_ID ? "" : "ES_CREDENTIAL_ID"}
        ${ES_TOTP_SECRET ? "" : "ES_TOTP_SECRET"}
        `);

        process.exit(1);
    }
}

exports.default = sign;
