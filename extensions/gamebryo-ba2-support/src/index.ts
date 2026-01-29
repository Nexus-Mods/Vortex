import loadBA2, { BA2Archive } from "ba2tk";
import Promise from "bluebird";
import { types, util } from "vortex-api";

const loadBA2async = Promise.promisify(loadBA2);

class BA2Handler implements types.IArchiveHandler {
  private mBA2: BA2Archive;
  constructor(ba2: BA2Archive) {
    this.mBA2 = ba2;
  }

  public readDir(archPath: string): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      // considering how Bethesda is happily mixing cases and this
      // being a windows-only game (on PC) I think it's safe to say BA2s
      // should be treated as case-insensitive
      let query = archPath.toLowerCase().replace(/\//g, "\\");
      if (!query.endsWith("\\")) {
        query = query + "\\";
      }
      const files: string[] = [];
      const subDirs = new Set<string>();
      this.mBA2.fileList.forEach((fileName) => {
        if (!fileName.toLowerCase().startsWith(query)) {
          return;
        }

        const nextBS = fileName.indexOf("\\", query.length);
        if (nextBS === -1) {
          files.push(fileName.substr(query.length));
        } else {
          subDirs.add(
            fileName.substr(query.length, nextBS - query.length).toLowerCase(),
          );
        }
      });
      resolve([].concat(Array.from(subDirs), files));
    });
  }

  public extractFile(filePath: string, outputPath: string): Promise<void> {
    throw new util.NotSupportedError();
  }

  public extractAll(outputPath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.mBA2.extractAll(outputPath, (readErr) => {
        if (readErr !== null) {
          reject(readErr);
        }
        resolve();
      });
    });
  }

  public readFile(filePath: string): NodeJS.ReadableStream {
    throw new util.NotSupportedError();
  }
}

function createBA2Handler(
  fileName: string,
  options: types.IArchiveOptions,
): Promise<types.IArchiveHandler> {
  return loadBA2async(fileName).then(
    (archive: BA2Archive) => new BA2Handler(archive),
  );
}

function init(context: types.IExtensionContext) {
  context.registerArchiveType("ba2", createBA2Handler);
  return true;
}

export default init;
