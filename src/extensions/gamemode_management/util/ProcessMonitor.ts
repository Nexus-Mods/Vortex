import { setToolPid, setToolStopped } from '../../../actions';
import { makeExeId } from '../../../reducers/session';
import { IDiscoveredTool } from '../../../types/IDiscoveredTool';
import { IExtensionApi } from '../../../types/IExtensionContext';
import { IState } from '../../../types/IState';
import { log } from '../../../util/log';
import { currentGame, currentGameDiscovery } from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';
import { setdefault } from '../../../util/util';

import { BrowserWindow } from 'electron';
import * as path from 'path';
import * as Redux from 'redux';
import * as winapi from 'winapi-bindings';

class ProcessMonitor {
  private mTimer: NodeJS.Timeout;
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

    if (process.type === 'renderer') {
      this.mWindow = require('@electron/remote').getCurrentWindow();
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

    const byPid: { [pid: number]: winapi.ProcessEntry } = processes.reduce((prev, proc) => {
      prev[proc.processID] = proc;
      return prev;
    }, {});

    const byName: { [exeId: string]: winapi.ProcessEntry[] } =
      processes.reduce((prev: { [exeId: string]: winapi.ProcessEntry[] }, entry) => {
        setdefault(prev, entry.exeFile.toLowerCase(), []).push(entry);
        return prev;
      }, {});
    const state = this.mStore.getState();

    const vortexPid = process.pid;

    const isChildProcess = (proc: winapi.ProcessEntry, visited: Set<number>): boolean => {
      if ((proc === undefined) || (proc.parentProcessID === 0)) {
        return false;
      } else if (visited.has(proc.parentProcessID)) {
        // a loop in process hierarchy? Apparently that is possible, see #6508
        return false;
      } else {
        visited.add(proc.parentProcessID);
        return (proc.parentProcessID === vortexPid)
            || isChildProcess(byPid[proc.parentProcessID], visited);
      }
    };

    const game = currentGame(state);
    const gameDiscovery = currentGameDiscovery(state);
    const gameExe = getSafe(gameDiscovery, ['executable'], undefined)
                 || getSafe(game, ['executable'], undefined);
    const gamePath = getSafe(gameDiscovery, ['path'], undefined);
    if ((gameExe === undefined) || (gamePath === undefined)) {
      // How in the world can we manage to get the executable for the game
      //  but not the path from the discovery object ?
      // https://github.com/Nexus-Mods/Vortex/issues/4656
      return;
    }

    const update = (exePath: string, exclusive: boolean, considerDetached: boolean) => {
      const exeId = makeExeId(exePath);
      const knownRunning = state.session.base.toolsRunning[exeId];
      const exeRunning = byName[exeId];

      if (exeRunning === undefined) {
        // nothing with a matching exe name is running
        if (knownRunning !== undefined) {
          this.mStore.dispatch(setToolStopped(exePath));
        }
        return;
      }

      if ((knownRunning !== undefined) && (byPid[knownRunning.pid] !== undefined)) {
        // we already know this tool is running and the corresponding process is still active
        return;
      }

      // at this point the tool is running (or an exe with the same name is)
      // and we don't know about it

      const candidates = considerDetached
        ? exeRunning
        : exeRunning.filter(proc => isChildProcess(proc, new Set()));
      const match = candidates.find(exe => {
        const modules = winapi.GetModuleList(exe.processID);

        return (modules.length > 0)
            && (modules[0].exePath.toLowerCase() === exePath.toLowerCase());
      });

      if (match !== undefined) {
        this.mStore.dispatch(setToolPid(exePath, match.processID, exclusive));
      } else if (knownRunning !== undefined) {
        this.mStore.dispatch(setToolStopped(exePath));
      }
    };

    const gameExePath = path.join(gamePath, gameExe);
    update(gameExePath, true, true);

    const discoveredTools: { [toolId: string]: IDiscoveredTool } =
      getSafe(state, ['settings', 'gameMode', 'discovered', game.id, 'tools'], {});

    Object.keys(discoveredTools).forEach(toolId => {
      if (discoveredTools[toolId].path === undefined) {
        return;
      }
      update(discoveredTools[toolId].path, discoveredTools[toolId].exclusive || false, false);
    });
  }
}

export default ProcessMonitor;
