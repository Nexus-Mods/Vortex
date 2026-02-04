import { ArcGame } from "./types";

import Promise from "bluebird";
import { spawn } from "child_process";
import * as path from "path";
import { generate as shortid } from "shortid";
import { fs, log, types, util } from "vortex-api";

export interface IARCOptions {
  compression?: boolean;
  forceCompression?: boolean;
  game?: ArcGame;
  version?: number;
}

interface IListEntry {
  path: string;
  filenameHash?: number;
  correctExt?: string;
  flags?: number;
  compressedSize?: number;
  realSize?: number;
}

function quote(input: string): string {
  return '"' + input + '"';
}

const winPathRE = /([a-zA-Z]:\\(?:[\w ]+\\)*[\w ]+(?:\.\w+)*)/;

class ARCWrapper {
  private mApi: types.IExtensionApi;

  constructor(api: types.IExtensionApi) {
    console.log("ARCWrapper constructor", api);
    this.mApi = api;
  }

  public list(archivePath: string, options?: IARCOptions): Promise<string[]> {
    const outputFile = archivePath + ".verbose.txt";
    let output: string[] = [];
    return this.run("l", [quote(archivePath)], options || {})
      .then(() => fs.readFileAsync(outputFile))
      .then((data) => {
        output = this.parseList(data.toString()).map((entry) => entry.path);
        return fs.unlinkAsync(outputFile);
      })
      .then(() => output);
  }

  public extract(
    archivePath: string,
    outputPath: string,
    options?: IARCOptions,
  ): Promise<void> {
    const ext = path.extname(archivePath);
    const baseName = path.basename(archivePath, ext);
    const id = shortid();
    const tempPath = path.join(path.dirname(archivePath), id + "_" + baseName);

    // have to temporarily move the archive because arctool will use the file name as the name
    // for the output directory and we want to avoid name conflicts
    return (
      fs
        .moveAsync(archivePath, tempPath + ext)
        .then(() =>
          this.run("x", ["-txt", quote(tempPath + ext)], options || {}),
        )
        .then(() => fs.moveAsync(tempPath + ext, archivePath))
        .then(() => fs.moveAsync(tempPath, outputPath, { overwrite: true }))
        // extracting generates a file order file we need to repackage correctly (in Dragon's Dogma at least).
        // Note that _ext_ may contain .vortex_backup if we're not deploying clean, the file list should not
        // contain that extension though
        .then(() =>
          fs
            .moveAsync(tempPath + ext + ".txt", outputPath + ".arc.txt", {
              overwrite: true,
            })
            .catch(() => null),
        )
    );
  }

  public create(
    archivePath: string,
    source: string,
    options?: IARCOptions,
  ): Promise<void> {
    const args: string[] = [];

    return fs
      .statAsync(source + ".arc.txt")
      .then(() => {
        args.push("-txt");
      })
      .catch((err) => {
        // this very likely means the mod isn't going to work because it indicates
        // the "original" file doesn't exist, at least not in the same folder, so this
        // arc file will not get loaded by the game.
        log("warn", "file order file missing", { source, error: err.message });
      })
      .then(() => this.run("c", [...args, quote(source)], options || {}))
      .then(() =>
        fs.moveAsync(source + ".arc", archivePath, { overwrite: true }),
      );
  }

  private parseList(input: string): IListEntry[] {
    const res = [];
    let current: IListEntry;
    input.split("\n").forEach((line) => {
      const arr = line.trim().split("=");
      if (arr.length !== 2) {
        return;
      }
      const [key, value] = arr;

      if (key === "Path") {
        if (current !== undefined) {
          res.push(current);
        }
        current = {
          path: value,
        };
      } else if (current !== undefined) {
        current[key] = value;
      }
    });
    return res;
  }

  private run(
    command: string,
    parameters: string[],
    options: IARCOptions,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let args = [
        "-" + command,
        options.game !== undefined ? "-" + options.game : "-DD",
        "-pc",
        // this should be ok but if we ever support merging in loose files, we'd probably
        // want the extensions to be "corrected"
        // '-noextcorrect',
        // texRE6 is the default anyway
        "-texRE6",
        // this is set by guides around Dragon's Dogma. Not sure if/why this is necessary
        "-alwayscomp",
      ];

      if (options.version !== undefined) {
        args.push("-v");
        args.push(options.version.toFixed());
      } else {
        // correct default for Dragon's Dogma? We don't currently have a way
        // to set options from the game extension so not entirely sure how to correctly
        // set this if/when this extension is used for other games
        args.push("-v", "7");
      }
      args = args.concat(parameters);

      const process = spawn(quote(path.join(__dirname, "ARCtool.exe")), args, {
        shell: true,
      });

      const errorLines = [];

      process.on("error", (err) => reject(err));

      process.on("close", (code) => {
        if (code !== 0) {
          log("error", "ARCtool.exe failed with status code " + code);

          this.mApi.showErrorNotification(
            "ARCtool has failed.",
            "ARCtool.exe failed with status code " + code,
            {
              allowReport: false,
            },
          );
          return reject(
            new util.ProcessCanceled(
              "ARCtool.exe failed with status code " + code,
            ),
          );
        }

        // unfortunately ARCtool returns 0 even in error cases
        if (errorLines.length !== 0) {
          const err = new Error(errorLines.join("\n"));
          err["attachLogOnReport"] = true;
          return reject(err);
        }
        return resolve();
      });

      process.stdout.on("data", (data) => {
        const lines = data.toString().split("\n");
        lines.forEach((line) => {
          if (line.startsWith("Error")) {
            errorLines.push(line.replace(winPathRE, '"$1"'));
          }
        });
      });
      process.stderr.on("data", (data) => {
        // ARCTool doesn't use stderr
        data
          .toString()
          .split("\n")
          .forEach((line) => errorLines.push(line));
      });
    });
  }
}

export default ARCWrapper;
