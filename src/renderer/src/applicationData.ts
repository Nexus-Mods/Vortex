import type { VortexPaths } from "@vortex/shared/ipc";

export class ApplicationData {
  #name: string;
  #version: string;
  #windowId: number;
  #paths: VortexPaths;

  static #instance: ApplicationData | null;

  private constructor(name: string, windowId: number, version: string, paths: VortexPaths) {
    this.#name = name;
    this.#windowId = windowId;
    this.#version = version;
    this.#paths = paths;
  }

  public static async init(): Promise<ApplicationData> {
    if (this.#instance) {
      throw new Error("Already initialized!");
    }

    const name = await window.api.app.getName();
    const windowId = await window.api.window.getId();
    const version = await window.api.app.getVersion();
    const paths = await window.api.app.getVortexPaths();

    const instance = new ApplicationData(name, windowId, version, paths);
    this.#instance = instance;

    return this.#instance;
  }

  static get instance(): ApplicationData {
    if (this.#instance) {
      return this.#instance;
    }

    throw new Error("Not yet initialized!");
  }

  get name(): string {
    return this.#name;
  }

  get windowId(): number {
    return this.#windowId;
  }

  get version(): string {
    return this.#version;
  }

  get paths(): VortexPaths {
    return this.#paths;
  }
}
