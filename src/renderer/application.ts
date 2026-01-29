export class Application {
  static #instance: Application | null = null;
  static #isInitialized = false;

  static getInstance(): Application {
    if (!Application.#isInitialized) throw new Error("Type isn't ready yet!");
    if (!Application.#instance) throw new Error("Initialization failed!");
    return Application.#instance;
  }

  static async init(): Promise<void> {
    if (Application.#isInitialized)
      throw new Error("Type was already initialized!");

    const version = await window.api.app.getAppVersion();
    const name = await window.api.app.getAppName();

    Application.#instance = new Application(version, name);
  }

  #version: string;
  #name: string;

  constructor(version: string, name: string) {
    this.#version = version;
    this.#name = name;
  }

  getVersion(): string {
    return this.#version;
  }

  getName(): string {
    return this.#name;
  }
}
