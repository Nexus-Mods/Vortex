import * as path from "path";
import * as process from "process";
import { log, types, util } from "vortex-api";
import * as which from "which";

function exeExtension(): string {
  return process.platform === "win32" ? ".exe" : "";
}

function findJava(): string {
  if (process.env.JAVA_HOME === undefined) {
    return undefined;
  }
  const fileName = "java" + exeExtension();
  // TODO: A bit too simplistic, check the registry on windows
  return path.join(process.env.JAVA_HOME, "bin", fileName);
}

function findPython(): string {
  try {
    return which.sync("python");
  } catch (err) {
    log("info", "python not found", err.message);
    return undefined;
  }
}

const javaPath: string = findJava();
const pythonPath: string = findPython();

function init(context: types.IExtensionContext): boolean {
  context.registerInterpreter(".jar", (input: types.IRunParameters) => {
    if (javaPath === undefined) {
      throw new (util as any).MissingInterpreter(
        "Java isn't installed",
        "https://www.java.com/de/download/",
      );
    }
    return {
      executable: javaPath,
      args: ["-jar", input.executable].concat(input.args),
      options: input.options,
    };
  });

  context.registerInterpreter(".vbs", (input: types.IRunParameters) => {
    return {
      executable: path.join(process.env.windir, "system32", "cscript.exe"),
      args: [input.executable].concat(input.args),
      options: input.options,
    };
  });

  context.registerInterpreter(".py", (input: types.IRunParameters) => {
    if (pythonPath === undefined) {
      throw new (util as any).MissingInterpreter(
        "Python isn't installed",
        "https://www.python.org/downloads/",
      );
    }
    return {
      executable: pythonPath,
      args: [input.executable].concat(input.args),
      options: input.options,
    };
  });

  if (process.platform === "win32") {
    context.registerInterpreter(".cmd", (input: types.IRunParameters) => {
      return {
        executable: "cmd.exe",
        args: ["/K", `"${input.executable}"`].concat(input.args),
        options: input.options,
      };
    });

    context.registerInterpreter(".bat", (input: types.IRunParameters) => {
      return {
        executable: "cmd.exe",
        args: ["/K", `"${input.executable}"`].concat(input.args),
        options: {
          ...input.options,
          shell: true,
        },
      };
    });
  }
  return true;
}

export default init;
