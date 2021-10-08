import local from './local';

export interface IApplication {
  name: string;
  version: string;
  isFocused: boolean;
  window: Electron.BrowserWindow;
  memory: {
    total: number;
  };
  quit: (exitCode?: number) => void;
}

const app: { inst: IApplication } = local('application_global', { inst: {
  name: 'vortex',
  version: '0.0.1',
  isFocused: true,
  window: null,
  memory: {
    total: 0,
  },
  quit: (code?: number) => process['exit'](code),
}});

export function setApplication(appIn: IApplication) {
  app.inst = appIn;
}

export function getApplication() {
  return app.inst;
}

const proxy: unknown = new Proxy(app, {
  get: (target, key, receiver) => Reflect.get(target.inst, key, receiver),
  set: () => { throw new Error('attempt to change read-only object'); },
  deleteProperty: () => { throw new Error('attempt to change read-only object'); },
});

export default proxy as IApplication;
