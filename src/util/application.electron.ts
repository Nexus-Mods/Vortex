import { app as appIn } from "electron";

import type { IApplication } from "./application";

import { setApplication } from "./application";

class ElectronApplication implements IApplication {
  private mName: string;
  private mVersion: string;

  constructor() {
    const remote =
      process.type === "browser" ? undefined : require("@electron/remote");
    const app = remote?.app ?? appIn;

    this.mName = app.name;
    this.mVersion = app.getVersion();
  }

  public get name() {
    return this.mName;
  }

  public get version() {
    return this.mVersion;
  }
}

setApplication(new ElectronApplication());
