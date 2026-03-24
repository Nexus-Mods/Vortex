import path from "path";
import sass from "sass";
import { pathToFileURL } from "url";

import { getVortexPath } from "./getVortexPath";
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
    let themePath: string = ".";

    const source = filePaths
      .map((filePath) => {
        const fixedPath = StylesheetCompiler.fixPath(filePath);
        const importDecleration = `@import "${fixedPath}";`;

        if (path.extname(fixedPath) !== ".scss") {
          if (path.dirname(filePath) !== ".") {
            themePath = path.dirname(filePath);
          }
          return importDecleration + "\n";
        }

        const sanitizedName = StylesheetCompiler.sanitize(
          path.basename(fixedPath, ".scss"),
        );
        return `*, #added_by_${sanitizedName} { ${importDecleration} }\n`;
      })
      .join("\n");

    return `$theme-path: "${pathToFileURL(themePath).toString()}";\n` + source;
  }

  private compile(source: string): string {
    const result = this.#compiler.compileString(source, {
      loadPaths: this.#loadPaths,
      style: this.#style,
      // Silence deprecation warnings from dependencies (node_modules)
      // while still showing warnings from our own code
      quietDeps: true,
      silenceDeprecations: ["import"],
    });

    // Remove UTF-8 BOM if present (ef bb bf)
    // The BOM can cause CSS parsing issues when the CSS is injected inline into HTML
    let css = result.css;
    if (css.charCodeAt(0) === 0xfeff) {
      css = css.substring(1);
    }

    return css;
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
