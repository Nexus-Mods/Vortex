import { removeExtension, setExtensionEnabled } from '../../actions/app';
import Dropzone, { DropType } from '../../controls/Dropzone';
import FlexLayout from '../../controls/FlexLayout';
import Table, { ITableRowAction } from '../../controls/Table';
import { IExtensionLoadFailure, IExtensionState, IState } from '../../types/IState';
import { ITableAttribute } from '../../types/ITableAttribute';
import { ComponentEx, connect, translate } from '../../util/ComponentEx';
import * as fs from '../../util/fs';
import getVortexPath from '../../util/getVortexPath';
import * as selectors from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';
import MainPage from '../../views/MainPage';

import { IDownload } from '../download_management/types/IDownload';

import installExtension from './installExtension';
import getTableAttributes from './tableAttributes';
import { IExtension, IExtensionWithState } from './types';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as _ from 'lodash';
import * as path from 'path';
import * as React from 'react';
import { Alert, Button, Panel } from 'react-bootstrap';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

interface IConnectedProps {
  extensionConfig: { [extId: string]: IExtensionState };
  downloads: { [dlId: string]: IDownload };
  downloadPath: string;
  loadFailures: { [extId: string]: IExtensionLoadFailure[] };
}

interface IActionProps {
  onSetExtensionEnabled: (extId: string, enabled: boolean) => void;
  onRemoveExtension: (extId: string) => void;
}

type IProps = IConnectedProps & IActionProps;

interface IComponentState {
  extensions: { [extId: string]: IExtension };
  oldExtensionConfig: { [extId: string]: IExtensionState };
  reloadNecessary: boolean;
}

function getAllDirectories(searchPath: string): Promise<string[]> {
  return fs.readdirAsync(searchPath)
    .filter(fileName =>
      fs.statAsync(path.join(searchPath, fileName))
        .then(stat => stat.isDirectory()));
}

function applyExtensionInfo(id: string, bundled: boolean, values: any): IExtension {
  return {
    name: values.name || id,
    author: values.author || 'Unknown',
    version: values.version || '0.0.0',
    description: values.description || 'Missing',
    bundled,
  };
}

function readExtensionInfo(extensionPath: string,
                           bundled: boolean): Promise<{ id: string, info: IExtension }> {
  const id = path.basename(extensionPath);
  return fs.readFileAsync(path.join(extensionPath, 'info.json'), { encoding: 'utf-8' })
    .then(info => ({
      id, info: applyExtensionInfo(id, bundled, JSON.parse(info)),
    }))
    .catch(err => ({
      id, info: applyExtensionInfo(id, bundled, {}),
    }));
}

class ExtensionManager extends ComponentEx<IProps, IComponentState> {
  private staticColumns: ITableAttribute[];
  private actions: ITableRowAction[];

  constructor(props: IProps) {
    super(props);
    this.initState({
      extensions: {},
      oldExtensionConfig: props.extensionConfig,
      reloadNecessary: false,
    });

    this.actions = [
      {
        icon: 'delete',
        title: 'Remove',
        action: this.removeExtension,
        condition: (instanceId: string) => !this.state.extensions[instanceId].bundled,
        singleRowAction: true,
      },
    ];

    this.staticColumns = getTableAttributes({
      onSetExtensionEnabled:
        (extName: string, enabled: boolean) => {
          const extId = Object.keys(this.state.extensions)
            .find(iter => this.state.extensions[iter].name === extName);
          this.props.onSetExtensionEnabled(extId, enabled);
        },
      onToggleExtensionEnabled:
        (extName: string) => {
          const extId = Object.keys(this.state.extensions)
            .find(iter => this.state.extensions[iter].name === extName);
          const { extensionConfig, onSetExtensionEnabled } = this.props;
          onSetExtensionEnabled(extId, !getSafe(extensionConfig, [extId, 'enabled'], true));
        },
    });
  }

  public componentDidMount() {
    this.readExtensions();
  }

  public render(): JSX.Element {
    const {t, extensionConfig} = this.props;
    const {extensions, reloadNecessary, oldExtensionConfig} = this.state;

    const extensionsWithState = this.mergeExt(extensions, extensionConfig);

    const PanelX: any = Panel;

    return (
      <MainPage>
        <MainPage.Body>
          <Panel>
            <PanelX.Body>
              <FlexLayout type='column'>
                <FlexLayout.Fixed>
                  {
                    reloadNecessary || !_.isEqual(extensionConfig, oldExtensionConfig)
                      ? this.renderReload()
                      : null
                  }
                </FlexLayout.Fixed>
                <FlexLayout.Flex>
                  <Table
                    tableId='extensions'
                    data={extensionsWithState}
                    actions={this.actions}
                    staticElements={this.staticColumns}
                    multiSelect={false}
                  />
                </FlexLayout.Flex>
                <FlexLayout.Fixed>
                  <Dropzone
                    accept={['files']}
                    drop={this.dropExtension}
                    dialogHint={t('Select extension file')}
                  />
                </FlexLayout.Fixed>
              </FlexLayout>
            </PanelX.Body>
          </Panel>
        </MainPage.Body>
      </MainPage>
    );
  }

  private dropExtension = (type: DropType, extPaths: string[]): void => {
    const { downloads } = this.props;
    let success = false;
    const prop: Promise<void[]> = (type === 'files')
      ? Promise.map(extPaths, extPath => installExtension(extPath)
          .then(() => { success = true; })
          .catch(err => {
            this.context.api.showErrorNotification('Failed to install extension', err,
                                                   { allowReport: false });
          }))
      : Promise.map(extPaths, url => new Promise<void>((resolve, reject) => {
        this.context.api.events.emit('start-download', [url], undefined,
                                     (error: Error, id: string) => {
          const dlPath = path.join(this.props.downloadPath, downloads[id].localPath);
          installExtension(dlPath)
          .then(() => {
            success = true;
          })
          .catch(err => {
            this.context.api.showErrorNotification('Failed to install extension', err,
                                                   { allowReport: false });
          })
          .finally(() => {
            resolve();
          });
        });
      }));
    prop.then(() => {
      if (success) {
        this.nextState.reloadNecessary = true;
      }
      this.readExtensions();
    });
  }

  private renderReload(): JSX.Element {
    const {t} = this.props;
    return (
      <Alert bsStyle='warning' style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ flexGrow: 1 }}>{t('You need to restart Vortex to apply changes.')}</div>
        <Button onClick={this.restart}>{t('Restart')}</Button>
      </Alert>
    );
  }

  private restart = () => {
    remote.app.relaunch();
    remote.app.exit(0);
  }

  private mergeExt(extensions: { [id: string]: IExtension },
                   extensionConfig: { [id: string]: IExtensionState })
                   : { [id: string]: IExtensionWithState } {
    const { loadFailures } = this.props;
    return Object.keys(extensions).reduce((prev, id) => {
      if (!getSafe(extensionConfig, [id, 'remove'], false)) {
        const enabled = loadFailures[id] === undefined ?
          getSafe(extensionConfig, [id, 'enabled'], true)
          : 'failed';
        prev[id] = {
          ...extensions[id],
          enabled,
          loadFailures: loadFailures[id] || [],
        };
      }
      return prev;
    }, {});
  }

  private removeExtension = (extId: string) => {
    this.props.onRemoveExtension(extId);
    this.nextState.reloadNecessary = true;
  }

  private readExtensions() {
    const bundledPath = getVortexPath('bundledPlugins');
    const extensionsPath = path.join(remote.app.getPath('userData'), 'plugins');

    let bundledExtensions;
    let dynamicExtensions;

    getAllDirectories(bundledPath)
      .map((extPath: string) => path.join(bundledPath, extPath))
      .map((fullPath: string) => readExtensionInfo(fullPath, true))
      .then(extensionInfo => {
        bundledExtensions = extensionInfo;
        return getAllDirectories(extensionsPath);
      })
      .map((extPath: string) => path.join(extensionsPath, extPath))
      .map((fullPath: string) => readExtensionInfo(fullPath, false))
      .then(extensionInfo => {
        dynamicExtensions = extensionInfo;
      })
      .then(() => {
        this.nextState.extensions = [].concat(bundledExtensions, dynamicExtensions)
          .reduce((prev, value) => {
            prev[value.id] = value.info;
            return prev;
          }, {});
      })
      .catch(err => {
        // this probably only occurs if the user deletes the plugins directory after start
        this.context.api.showErrorNotification('Failed to read extension directory', err, {
          allowReport: false,
        });
      });
  }
}

const emptyObject = {};

function mapStateToProps(state: IState): IConnectedProps {
  return {
    // TODO: don't use || {} in mapStateToProps because {} is always a new object and
    //   thus causes constant re-drawing. but when removing this, make sure no access
    //   to undefined can happen
    extensionConfig: state.app.extensions || emptyObject,
    loadFailures: state.session.base.extLoadFailures,
    downloads: state.persistent.downloads.files,
    downloadPath: selectors.downloadPath(state),
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onSetExtensionEnabled: (extId: string, enabled: boolean) =>
      dispatch(setExtensionEnabled(extId, enabled)),
    onRemoveExtension: (extId: string) => dispatch(removeExtension(extId)),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      ExtensionManager)) as React.ComponentClass<{}>;
