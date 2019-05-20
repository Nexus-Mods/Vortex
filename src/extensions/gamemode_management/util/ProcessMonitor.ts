import { setToolStopped, setToolPid } from '../../../actions';
import { makeExeId } from '../../../reducers/session';
import { IDiscoveredTool } from '../../../types/IDiscoveredTool';
import { IExtensionApi } from '../../../types/IExtensionContext';
import { IState } from '../../../types/IState';
import { log } from '../../../util/log';
import { currentGameDiscovery, currentGame } from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';

import { remote, BrowserWindow } from 'electron';
import * as path from 'path';
import * as Redux from 'redux';
import * as winapi from 'winapi-bindings';

class ProcessMonitor {
  private mTimer: NodeJS.Timer;
  private mStore: Redux.Store<IState>;
  private mWindow: BrowserWindow;
  private mActive: boolean = false;

  constructor(api: IExtensionApi) {
    this.mStore = api.store;
  }

  public start(): void {
    if (winapi.GetProcessList === undefined) {
      // Linux, MacOS
      return;
    }
    if (this.mActive) {
      // already running
      return;
    }

    if (this.mTimer !== undefined) {
      // ensure we don't have multiple timers running in parallel
      clearTimeout(this.mTimer);
    }

    if (remote !== undefined) {
      this.mWindow = remote.getCurrentWindow();
    }

    log('debug', 'start process monitor');
    this.mTimer = setTimeout(() => this.check(), 2000);
    this.mActive = true;
  }

  public end(): void {
    if (this.mTimer === undefined) {
      // not running
      return;
    }
    clearTimeout(this.mTimer);
    this.mTimer = undefined;
    this.mActive = false;
    log('debug', 'stop process monitor');
  }

  private check(): void {
    if (!this.mActive) {
      return;
    }
    // skip check and tick slower when in background, for performance reasons
    if ((this.mWindow === undefined) || this.mWindow.isFocused()) {
      this.doCheck();
      if (this.mActive) {
        this.mTimer = setTimeout(() => this.check(), 2000);
      }
    } else {
      this.mTimer = setTimeout(() => this.check(), 5000);
    }
  }

  private doCheck(): void {
    const processes = winapi.GetProcessList();
    const runningExes: { [exeId: string]: winapi.ProcessEntry } =
      processes.reduce((prev, entry) => {
        prev[entry.exeFile.toLowerCase()] = entry;
        return prev;
      }, {});
    const state = this.mStore.getState();

    // stop tools no longer running
    Object.keys(state.session.base.toolsRunning)
      .forEach(exeId => {
        if (runningExes[exeId] === undefined) {
          this.mStore.dispatch(setToolStopped(exeId));
        }
      });

    // now mark running or update tools that are running
    //   this feels a bit complicated...
    const game = currentGame(state);
    const gameDiscovery = currentGameDiscovery(state);
    const gameExe = getSafe(gameDiscovery, ['executable'], undefined)
                 || getSafe(game, ['executable'], undefined);

    if (gameExe === undefined) {
      return;
    }

    const update = (exePath: string, exclusive: boolean) => {
      const exeId = makeExeId(exePath);
      const exeRunning = runningExes[exeId];
      if (exeRunning === undefined) {
        return;
      }

      const modules = winapi.GetModuleList((runningExes[exeId] as any).processID);

      if ((modules.length === 0) || modules[0].exePath !== exePath) {
        return;
      }

      if ((state.session.base.toolsRunning[exeId] === undefined)
          || (state.session.base.toolsRunning[exeId].pid !== exeRunning.processID)) {
        this.mStore.dispatch(setToolPid(exePath, exeRunning.processID, exclusive));
      }
    };


    const gameExePath = path.join(gameDiscovery.path, gameExe);
    update(gameExePath, true);

    const discoveredTools: { [toolId: string]: IDiscoveredTool } =
      getSafe(state, ['settings', 'gameMode', 'discovered', game.id, 'tools'], {});

    Object.keys(discoveredTools).forEach(toolId => {
      if (discoveredTools[toolId].path === undefined) {
        return;
      }
      update(discoveredTools[toolId].path, discoveredTools[toolId].exclusive || false);
    });
  }
}

export default ProcessMonitor;
