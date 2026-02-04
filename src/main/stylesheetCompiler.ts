import path from "path";
import sass from "sass";

import getVortexPath from "./getVortexPath";
import { betterIpcMain } from "./ipc";
import { log } from "./logging";

export default class StylesheetCompiler {
  static #instance: StylesheetCompiler | null = null;

  readonly #compiler: sass.Compiler;
  readonly #style: sass.OutputStyle;
  readonly #loadPaths: string[];

  constructor() {
    this.#compiler = sass.initCompiler();
    this.#style =
      process.env.NODE_ENV === "development" ? "expanded" : "compressed";

    const assetsPath = path.join(getVortexPath("assets_unpacked"), "css");
    const modulesPath = getVortexPath("modules_unpacked");
    this.#loadPaths = [assetsPath, modulesPath];

    log(
      "debug",
      "using laod paths for stylesheet compilation",
      this.#loadPaths,
    );

    betterIpcMain.handle("styles:compile", (_, filePaths) => {
      const started = Date.now();
      log("info", "compiling stylesheets", { count: filePaths.length });
      const source = this.createSource(filePaths);
      const css = this.compile(source);
      log("info", "finished compiling stylesheets", {
        duration: Date.now() - started,
      });
      return css;
    });
  }

  private createSource(filePaths: string[]): string {
    const source = filePaths
      .map((filePath) => {
        const fixedPath = StylesheetCompiler.fixPath(filePath);
        const importDecleration = `@import "${fixedPath}";`;

        if (path.extname(fixedPath) !== ".scss") {
          return importDecleration + "\n";
        }

        const sanitizedName = StylesheetCompiler.sanitize(
          path.basename(fixedPath, ".scss"),
        );
        return `*, #added_by_${sanitizedName} { ${importDecleration} }\n`;
      })
      .join("\n");

    return source;
  }

  private compile(source: string): string {
    const result = this.#compiler.compileString(source, {
      loadPaths: this.#loadPaths,
      style: this.#style,
    });

    return result.css;
  }

  private static sanitize(input: string): string {
    const invalidCharacters = /[ .#()]/g;
    const res = input.toLowerCase().replace(invalidCharacters, "-");
    if (res.endsWith("-")) return res + "_";
    return res;
  }

  private static fixPath(inputPath: string): string {
    if (path.isAbsolute(inputPath)) {
      inputPath = inputPath.replace(
        "app.asar" + path.sep,
        "app.asar.unpacked" + path.sep,
      );
    }

    return inputPath.replaceAll("\\", "\\\\");
  }

  public static init(): StylesheetCompiler {
    if (this.#instance) throw new Error("Already initialized");
    this.#instance = new StylesheetCompiler();
    return this.#instance;
  }
}

// Auto-initialize when module is imported
StylesheetCompiler.init();
