import { IListEntry, IQBMSOpProps, IQBMSOptions, QuickBMSError } from "./types";

import Promise from "bluebird";
import { spawn } from "child_process";
import * as path from "path";

import { fs, log, util } from "vortex-api";

const FILTER_FILE_PATH = path.join(
  util.getVortexPath("userData"),
  "temp",
  "qbms",
  "filters.txt",
);
const LOG_FILE_PATH = path.join(util.getVortexPath("userData"), "quickbms.log");
const TIMEOUT_MSEC = 15000;
const CHECK_TIME_MSEC = 5000;

const QUICK_BMS_ERRORMSG = [
  "success", // 0
  "encountered an unknown error", // 1
  "unable to allocate memory, memory errors", // 2
  "missing input file", // 3
  "unable to write output file", // 4
  "file compression error (Review BMS script)", // 5
  "file encryption error (Review BMS script)", // 6
  "external dll file has reported an error", // 7
  "BMS script syntax error", // 8
  "invalid quickbms arguments provided", // 9
  "error accessing input/output folder", // 10
  "user/external application has terminated quickBMS", // 11
  "extra IO error", // 12
  "failed to update quickbms", // 13
  "QBMS has timed out", // 14 - this is reported by the timeout functionality.
];

function quote(input: string): string {
  return '"' + input + '"';
}

function parseList(input: string, wildCards: string[]): IListEntry[] {
  const lines = input.split("\n");
  const wildCardRgx = /{}|\*/g;
  const regexps: RegExp[] = wildCards.reduce((accum, wildCard) => {
    if (wildCardRgx.test(wildCard)) {
      const replacement = wildCard.replace(wildCardRgx, ".*");
      accum.push(new RegExp(replacement, "g"));
    }
    return accum;
  }, []);
  const findMatch = (filePath: string) => {
    if (wildCards.includes(filePath)) {
      return true;
    }

    let matched = false;
    for (const rgx of regexps) {
      if (rgx.test(filePath)) {
        matched = true;
        break;
      }
    }

    return matched;
  };
  const filtered: string[] = lines.filter(
    (line) => !!line && !line.includes("- filter"),
  );
  const res: IListEntry[] = filtered.reduce((accum, line) => {
    const arr = line
      .trim()
      .split(" ")
      .filter((entry) => !!entry);
    if (arr.length === 3) {
      const [offset, size, filePath] = arr;
      if (findMatch(filePath)) {
        accum.push({ offset, size, filePath });
      }
    }
    return accum;
  }, []);

  return res;
}

function validateArguments(
  archivePath: string,
  bmsScriptPath: string,
  outPath: string,
  options: IQBMSOptions,
): Promise<void> {
  if (path.extname(bmsScriptPath) !== ".bms") {
    // Invalid argument - we were expecting a bms script.
    return Promise.reject(new util.ArgumentInvalid("bmsScriptPath"));
  }
  if (!path.isAbsolute(archivePath)) {
    // The archive's absolute path should've been provided.
    return Promise.reject(new util.ArgumentInvalid("archivePath"));
  }
  if (!path.isAbsolute(outPath)) {
    // outPath must be a directory and point towards an absolute path.
    return Promise.reject(new util.ArgumentInvalid("outPath"));
  }

  return Promise.resolve();
}

function run(
  command: string,
  parameters: string[],
  options: IQBMSOptions,
): Promise<void> {
  let timer: NodeJS.Timeout;
  let isClosed: boolean = false;
  let lastMessageReceived: number;
  let wstream;
  const createLog = !!options.createLog || command === "l";
  if (createLog) {
    wstream = fs.createWriteStream(LOG_FILE_PATH);
  }

  return new Promise<void>((resolve, reject) => {
    let args = [
      !!command ? " -" + command : undefined,
      options.allowResize !== undefined
        ? !options.allowResize
          ? "-r"
          : "-r -r"
        : undefined,
      !!options.quiet ? "-q" : undefined,
      !!options.overwrite ? "-o" : undefined,
      !!options.caseSensitive ? "-I" : undefined,
      !!options.keepTemporaryFiles ? "-T" : undefined,
      !!options.wildCards ? "-f " + quote(FILTER_FILE_PATH) : undefined,
    ];

    args = args.filter((arg) => arg !== undefined).concat(parameters);
    let process;
    // const theCommand = path.join(__dirname, 'quickbms_4gb_files.exe') + args.join(' ');
    try {
      process = spawn(
        quote(path.join(__dirname, "quickbms_4gb_files.exe")),
        args,
        {
          shell: true,
        },
      );
    } catch (err) {
      return reject(err);
    }

    if (timer === undefined) {
      lastMessageReceived = Date.now();
      timer = setTimeout(() => checkTimer(), CHECK_TIME_MSEC);
    }

    const onNewMessage = () => {
      lastMessageReceived = Date.now();
    };

    const stdInErrs: string[] = [];
    const checkTimer = () => {
      if (lastMessageReceived + TIMEOUT_MSEC <= Date.now()) {
        process.kill();
        clearTimeout(timer);
        timer = undefined;
      } else {
        // We haven't received any messages back from the qbms process
        //  in 5 seconds. This is generally a sign that qbms is stuck.
        //  Hitting any keyboard key will revive the process (even when
        //  running it manually); we're going to attempt to simulate
        //  a spacebar key press which should force the process back into
        //  gear.
        if (!isClosed) {
          try {
            process.stdin.write("\x20", (err: Error) => {
              stdInErrs.push(JSON.stringify(err, undefined, 2));
            });
            timer = setTimeout(() => checkTimer(), CHECK_TIME_MSEC);
          } catch (err) {
            isClosed = true;
            log("error", "failed to send keep alive", err);
            clearTimeout(timer);
            timer = undefined;
          }
        } else {
          clearTimeout(timer);
          timer = undefined;
        }
      }
    };

    const stdOutLines: string[] = [];
    const stdErrLines: string[] = [];

    process.on("error", (err) => {
      if (createLog) {
        wstream.close();
      }
      return reject(err);
    });

    process.on("close", (code, signal) => {
      // stdio streams are now closed.
      isClosed = true;
      if (signal === "SIGTERM") {
        if (!createLog) {
          // We timed out - We want this logged regardless of whether
          //  the create log switch has been provided!
          wstream = fs.createWriteStream(LOG_FILE_PATH);
        }
        const timeoutDump = [].concat(
          ["QBMS has timed out!"],
          stdErrLines,
          stdOutLines,
          stdInErrs,
        );
        timeoutDump.forEach((line) => wstream.write(line + "\n"));

        wstream.close();
        wstream = undefined;
        // tslint:disable-next-line: max-line-length
        return reject(
          new QuickBMSError(
            `quickbms(${signal}) - ${QUICK_BMS_ERRORMSG[14]}`,
            stdErrLines,
          ),
        );
      }

      if (!!wstream) {
        wstream.close();
        wstream = undefined;
      }

      if (code !== 0) {
        const errorMsg =
          code > QUICK_BMS_ERRORMSG.length - 1
            ? QUICK_BMS_ERRORMSG[1]
            : QUICK_BMS_ERRORMSG[code];
        return reject(
          new QuickBMSError(`quickbms(${code}) - ` + errorMsg, stdErrLines),
        );
      }

      const hasErrors =
        stdErrLines.find((line) => line.indexOf("Error:") !== -1) !== undefined;
      if (hasErrors) {
        return reject(new Error(stdErrLines.join("\n")));
      }
      return resolve();
    });

    process.stdout.on("data", (data) => {
      onNewMessage();
      const formatted = data.toString().split("\n");
      formatted.forEach((line) => {
        const formattedLine = line.replace(/\\/g, "/");
        stdOutLines.push(formattedLine);
        if (createLog) {
          wstream.write(formattedLine + "\n");
        }
      });
    });

    process.stderr.on("data", (data) => {
      onNewMessage();
      const formatted = data.toString().split("\n");
      formatted.forEach((line) => {
        stdErrLines.push(line);
      });
    });
  });
}

function createFiltersFile(wildCards: string[]): Promise<void> {
  return fs.ensureDirAsync(path.dirname(FILTER_FILE_PATH)).then(() =>
    fs
      .writeFileAsync(FILTER_FILE_PATH, wildCards.join("\n"))
      .then(() => Promise.resolve())
      .catch((err) => Promise.reject(err)),
  );
}

function removeFiltersFile(): Promise<void> {
  return fs
    .statAsync(FILTER_FILE_PATH)
    .then(() => fs.removeAsync(FILTER_FILE_PATH))
    .catch((err) =>
      err.code === "ENOENT" ? Promise.resolve() : Promise.reject(err),
    );
}

function reImport(props: IQBMSOpProps): Promise<void> {
  const { archivePath, bmsScriptPath, qbmsOptions, operationPath } = props;
  return validateArguments(
    archivePath,
    bmsScriptPath,
    operationPath,
    qbmsOptions,
  )
    .then(() =>
      !!qbmsOptions.wildCards
        ? createFiltersFile(qbmsOptions.wildCards)
        : Promise.resolve(),
    )
    .then(() =>
      qbmsOptions.allowResize !== undefined
        ? Promise.resolve()
        : Promise.reject(
            new util.ArgumentInvalid("Re-import version was not specified"),
          ),
    )
    .then(() =>
      run(
        "w",
        [quote(bmsScriptPath), quote(archivePath), quote(operationPath)],
        qbmsOptions,
      ),
    )
    .then(() => removeFiltersFile());
}

function extract(props: IQBMSOpProps): Promise<void> {
  const { archivePath, bmsScriptPath, qbmsOptions, operationPath } = props;
  return validateArguments(
    archivePath,
    bmsScriptPath,
    operationPath,
    qbmsOptions,
  )
    .then(() =>
      !!qbmsOptions.wildCards
        ? createFiltersFile(qbmsOptions.wildCards)
        : undefined,
    )
    .then(() =>
      run(
        undefined,
        [quote(bmsScriptPath), quote(archivePath), quote(operationPath)],
        qbmsOptions,
      ),
    )
    .then(() => removeFiltersFile());
}

function list(props: IQBMSOpProps): Promise<IListEntry[]> {
  const { archivePath, bmsScriptPath, qbmsOptions, operationPath } = props;
  return validateArguments(
    archivePath,
    bmsScriptPath,
    operationPath,
    qbmsOptions,
  )
    .then(() =>
      !!qbmsOptions.wildCards
        ? createFiltersFile(qbmsOptions.wildCards)
        : Promise.resolve(),
    )
    .then(() =>
      run(
        "l",
        [quote(bmsScriptPath), quote(archivePath), quote(operationPath)],
        qbmsOptions,
      ),
    )
    .then(() => removeFiltersFile())
    .then(() => fs.readFileAsync(LOG_FILE_PATH, { encoding: "utf-8" }))
    .then((data) => {
      const fileEntries: IListEntry[] = parseList(data, qbmsOptions.wildCards);
      return Promise.resolve(fileEntries);
    });
}

function write(props: IQBMSOpProps): Promise<void> {
  const { archivePath, bmsScriptPath, qbmsOptions, operationPath } = props;
  return validateArguments(
    archivePath,
    bmsScriptPath,
    operationPath,
    qbmsOptions,
  ).then(() =>
    run(
      "w",
      [quote(bmsScriptPath), quote(archivePath), quote(operationPath)],
      qbmsOptions,
    ),
  );
}

module.exports = {
  reImport,
  list,
  write,
  extract,
};
