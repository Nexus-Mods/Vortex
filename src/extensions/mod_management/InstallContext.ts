import { addNotification, dismissNotification } from '../../actions/notifications';
import { INotification } from '../../types/INotification';
import { log } from '../../util/log';
import { showError } from '../../util/message';

import { addMod, setModAttribute, setModInstallationPath, setModState } from './actions/mods';
import { IMod, ModState } from './types/IMod';

import { IInstallContext } from './types/IInstallContext';

interface IOnAddMod {
  (mod: IMod): void;
}

interface IFindTree {
  getNodeKey: Function;
  treeData: {};
  searchQuery: string | number;
  searchMethod: Function;
  searchFocusOffset: number;
  expandAllMatchPaths: boolean;
  expandFocusMatchPaths: boolean;
}

interface IGetNodeTree {
  treeData: {};
  path: number[]|string[];
  getNodeKey: Function;
  ignoreCollapsed: boolean;
}

interface IOnAddNotification {
  (notification: INotification): void;
}

class InstallContext implements IInstallContext {

  private mAddMod: (mod: IMod) => void;
  private mAddNotification: (notification: INotification) => void;
  private mDismissNotification: (id: string) => void;
  private mShowError: (message: string, details?: string | Error) => void;
  private mSetModState: (id: string, state: ModState) => void;
  private mSetModAttribute: (id: string, key: string, value: any) => void;
  private mSetModInstallationPath: (id: string, installPath: string) => void;

  constructor(dispatch: Redux.Dispatch<any>) {
    this.mAddMod = (mod) => dispatch(addMod(mod));
    this.mAddNotification = (notification) =>
      dispatch(addNotification(notification));
    this.mDismissNotification = (id) =>
      dispatch(dismissNotification(id));
    this.mShowError = (message, details?) =>
      showError(dispatch, message, details);
    this.mSetModState = (id, state) =>
      dispatch(setModState(id, state));
    this.mSetModAttribute = (id, key, value) =>
      dispatch(setModAttribute(id, key, value));
    this.mSetModInstallationPath = (id, installPath) =>
      dispatch(setModInstallationPath(id, installPath));
  }

  public startInstallCB(id: string, archiveId: string, destinationPath: string): void {
    const mod: IMod = {
      id,
      archiveId,
      installationPath: destinationPath,
      state: 'installing',
      attributes: {
        name: id,
        installTime: 'ongoing',
      },
    };

    this.mAddMod(mod);

    this.mAddNotification({
      id: 'install_' + id,
      message: 'Installing ' + id,
      type: 'activity',
    });
  }

  public finishInstallCB(id: string, success: boolean, treeDataObject?: any, info?: any): void {
    this.mDismissNotification('install_' + id);

    if (success) {
      this.mAddNotification({
        type: 'success',
        message: `${id} installed`,
        displayMS: 4000,
      });
      this.mSetModState(id, 'installed');
      this.mSetModAttribute(id, 'installTime', new Date());

      let treeFunctions = require('react-sortable-tree');
      try {
        let newTree: IFindTree = {
          getNodeKey: treeFunctions.defaultGetNodeKey,
          treeData: treeDataObject,
          searchQuery: 30,
          searchMethod: treeFunctions.defaultSearchMethod,
          searchFocusOffset: 0,
          expandAllMatchPaths: false,
          expandFocusMatchPaths: true,
        };

        let result = treeFunctions.find(newTree);
        let res: string = '';
        let pathList: string[] = [];

        result.matches[0].path.forEach(element => {
          pathList.push(element);
          let getNodeTree: IGetNodeTree = {
            treeData: treeDataObject,
            path: pathList,
            getNodeKey: treeFunctions.defaultGetNodeKey,
            ignoreCollapsed: true,
          };
          let tree = treeFunctions.getNodeAtPath(getNodeTree);
          if (res === '') {
            res = tree.node.title;
          } else {
            res = res + ' --> ' + tree.node.title;
          }
        });

        this.mSetModAttribute(id, 'category_detail', res);
      } catch (err) {
        log('error', 'Error finding the category path', err);
      }

      if (info !== undefined) {
        Object.keys(info).forEach(
          (key: string) => { this.mSetModAttribute(id, key, info[key]); });
      }
    }
  }

  public setInstallPathCB(id: string, installPath: string) {
    this.mSetModInstallationPath(id, installPath);
  }

  public reportError(message: string, details?: string | Error): void {
    log('error', 'install error', { message, details });
    this.mShowError(message, details);
  }

  public progressCB(percent: number, file: string): void {
    log('debug', 'install progress', { percent, file });
  }
}

export default InstallContext;
