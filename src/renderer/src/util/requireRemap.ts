import Module from "module";
import path from "node:path";

import * as electron from "./electron";

interface InternalModule extends Module {
  _load(request: string, parent?: Module | null, isMain?: boolean): unknown;
}

// when spawning a binary, the code doing the spawning will be baked by webpack
// in release builds and thus reside in the app.asar file.
// The binaries being spawned however have to be unpacked, so if the path being spawned
// includes something like __dirname we have to update that path to work.
class ChildProcessProxy {
  public get(target, key: PropertyKey): any {
    if (key === "__isProxied") {
      return true;
    } else if (key === "spawn") {
      return (command: string, ...args: readonly unknown[]) => {
        const appAsar = `${path.sep}app.asar${path.sep}`;
        command = command.replace(
          appAsar,
          `${path.sep}app.asar.unpacked${path.sep}`,
        );
        return target.spawn(command, ...args);
      };
    } else {
      return target[key];
    }
  }
}

const originalRequire = Module.prototype.require;
Module.prototype.require = function (modulePath) {
  if (modulePath === "libxmljs") {
    throw new Error(
      "libxmljs has been deprecated in favor of xml2js. Please disable any extensions that use it. (community extensions only)",
    );
  }
  return originalRequire.apply(this, arguments);
};

function patchedLoad(orig: InternalModule["_load"]): InternalModule["_load"] {
  return function (request, parent, ...rest) {
    if (
      request === "fs" &&
      (parent.filename.indexOf("graceful-fs") !== -1 ||
        parent.filename.indexOf("rimraf") !== -1)
    ) {
      request = "original-fs";
    } else if (request === "electron") {
      // Let the preload script get the real electron module
      if (parent.filename.indexOf("preload") !== -1) {
        return orig.apply(this, [request, parent, ...rest]);
      }

      return electron;
    }

    let res = orig.apply(this, [request, parent, ...rest]);

    if (request === "child_process" && !res.__isProxied) {
      res = new Proxy(res, new ChildProcessProxy());
    }

    return res;
  };
}

export default function () {
  const castModule = Module as unknown as InternalModule;

  const orig = castModule._load;
  castModule._load = patchedLoad(orig);
  return () => {
    castModule._load = orig;
  };
}
