import { unknownToError } from "@vortex/shared";
import { log } from "./logging";

type Partial =
  | { key: string; type: "extendable"; file?: string }
  | { type: "builtin"; file: string };

export default class StyleManager {
  #partials: Partial[];
  #timeoutId: number | null;

  constructor() {
    this.#partials = StyleManager.getDefaultPartials();
  }

  private static getDefaultPartials(): Partial[] {
    return [
      { type: "builtin", file: "functions" },
      { type: "builtin", file: "variables" },
      { type: "extendable", key: "variables" },
      { type: "builtin", file: "details" },
      { type: "extendable", key: "details" },
      { type: "builtin", file: "thirdparty" },
      { type: "builtin", file: "desktop" },
      { type: "builtin", file: "style" },
      { type: "extendable", key: "style" },
    ];
  }

  public addStylesheet(key: string, filePath: string): void {
    const partials = StyleManager.addStylesheet(this.#partials, key, filePath);
    this.#partials = partials;

    if (this.#timeoutId !== null) {
      window.clearTimeout(this.#timeoutId);
    }

    this.#timeoutId = window.setTimeout(() => {
      StyleManager.render(this.#partials).catch((err: unknown) => {
        log("error", "failed to compile stylesheets", unknownToError(err));
      });
    }, 200);
  }

  public async render(): Promise<void> {
    await StyleManager.render(this.#partials);
  }

  public static async renderDefault(): Promise<void> {
    await StyleManager.render(this.getDefaultPartials());
  }

  private static addStylesheet(
    partials: Partial[],
    key: string,
    filePath: string,
  ): Partial[] {
    const partial: Partial = { type: "extendable", key: key, file: filePath };

    const index = partials.findIndex(
      (partial) => partial.type === "extendable" && partial.key === key,
    );
    if (index !== -1) {
      partials = partials.toSpliced(index, 1, partial);
    } else {
      // NOTE(erri120): the "style" stylesheets are always last, we insert new stylesheets before them
      const styleIndex = partials.findLastIndex(
        (partial) => partial.type === "builtin" && partial.file === "style",
      );
      partials = partials.toSpliced(styleIndex, 0, partial);
    }

    return partials;
  }

  private static async render(partials: Partial[]): Promise<void> {
    const filePaths = partials
      .filter((partial) => partial.file)
      .map((partial) => partial.file);

    const css = await window.api.compileStylesheets(filePaths);
    this.applyCSS(css);
  }

  private static applyCSS(css: string) {
    const headElements = document.getElementsByTagName("head");
    if (headElements.length === 0) return;

    const headElement = headElements[0];

    const newStyleElement = document.createElement("style");
    newStyleElement.id = "theme";
    newStyleElement.innerHTML = css;

    const oldStyleElements = headElement.getElementsByTagName("style");
    for (const oldStyleElement of oldStyleElements) {
      if (oldStyleElement.id !== "theme") continue;
      headElement.removeChild(oldStyleElement);
      break;
    }

    headElement.appendChild(newStyleElement);
  }
}
