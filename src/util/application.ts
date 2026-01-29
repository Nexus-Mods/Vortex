import local from "./local";

export interface IApplication {
  name: string;
  version: string;
}

const app: { inst: IApplication } = local("application_global", {
  inst: {
    name: "vortex",
    version: "0.0.1",
  },
});

export function setApplication(appIn: IApplication) {
  app.inst = appIn;
}

export function getApplication() {
  return app.inst;
}
