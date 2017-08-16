import { removeExtension, setExtensionEnabled } from '../../actions/app';
import Dropzone, { ControlMode } from '../../controls/Dropzone';
import FlexLayout from '../../controls/FlexLayout';
import Table, { ITableRowAction } from '../../controls/Table';
import { IExtensionState, IState } from '../../types/IState';
import { ITableAttribute } from '../../types/ITableAttribute';
import { ComponentEx, connect, translate } from '../../util/ComponentEx';
import { getSafe } from '../../util/storeHelper';
import { spawnSelf } from '../../util/util';
import MainPage from '../../views/MainPage';

import { IDownload } from '../download_management/types/IDownload';
import { downloadPath } from '../mod_management/selectors';

import installExtension from './installExtension';
import getTableAttributes from './tableAttributes';
import { IExtension, IExtensionWithState } from './types';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as _ from 'lodash';
import * as path from 'path';
import * as React from 'react';
import { Alert, Button } from 'react-bootstrap';
import * as Redux from 'redux';

interface IConnectedProps {
  extensionConfig: { [extId: string]: IExtensionState };
  downloads: { [dlId: string]: IDownload };
  downloadPath: string;
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
    .filter<string>(fileName =>
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
  return fs.readFileAsync(path.join(extensionPath, 'info.json'))
    .then(info => ({
      id, info: applyExtensionInfo(id, bundled, JSON.parse(info.toString())),
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
        icon: 'remove',
        title: 'Remove',
        action: this.removeExtension,
        condition: (instanceId: string) => !this.state.extensions[instanceId].bundled,
        singleRowAction: true,
      },
    ];

    this.staticColumns = getTableAttributes({
      onSetExtensionEnabled:
        (extId: string, enabled: boolean) => this.props.onSetExtensionEnabled(extId, enabled),
      onToggleExtensionEnabled:
        (extId: string) => {
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

    return (
      <MainPage>
        <MainPage.Body>
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
                accept={['files', 'urls']}
                drop={this.dropExtension}
                dialogHint={t('Select extension file')}
              />
            </FlexLayout.Fixed>
          </FlexLayout>
        </MainPage.Body>
      </MainPage>
    );
  }

  private dropExtension = (type: ControlMode, extPaths: string[]) => {
    if (type === 'files') {
      Promise.map(extPaths, extPath => installExtension(extPath).catch(err => {
        this.context.api.showErrorNotification('Failed to install extension', err);
      }))
      .then(() => {
        this.nextState.reloadNecessary = true;
        this.readExtensions();
      });
    } else {
      const { downloads } = this.props;
      Promise.map(extPaths, url => new Promise((resolve, reject) => {
        this.context.api.events.emit('start-download', {}, (error: Error, id: string) => {
          const dlPath = path.join(this.props.downloadPath, downloads[id].localPath);
          installExtension(dlPath)
          .catch(err => {
            this.context.api.showErrorNotification('Failed to install extension', err);
          })
          .then(() => resolve());
        });
      }))
      .then(() => {
        this.nextState.reloadNecessary = true;
        this.readExtensions();
      });
    }
  }

  private renderReload(): JSX.Element {
    const {t} = this.props;
    return (
      <Alert bsStyle='warning' style={{ display: 'flex' }}>
        <p style={{ flexGrow: 1 }}>{t('You need to restart Vortex to apply changes.')}</p>
        <Button onClick={this.restart}>{t('Restart')}</Button>
      </Alert>
    );
  }

  private restart = () => {
    spawnSelf(['--wait']);
    remote.app.exit(0);
  }

  private mergeExt(extensions: { [id: string]: IExtension },
                   extensionConfig: { [id: string]: IExtensionState })
                   : { [id: string]: IExtensionWithState } {
    return Object.keys(extensions).reduce((prev, id) => {
      if (!getSafe(extensionConfig, [id, 'remove'], false)) {
        prev[id] = {
          ...extensions[id],
          enabled: getSafe(extensionConfig, [id, 'enabled'], true),
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
    const bundledPath = path.resolve(__dirname, '..', '..', 'bundledPlugins');
    const extensionsPath = path.join(remote.app.getPath('userData'), 'plugins');
    const extensions: { [extId: string]: IExtension } = {};

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
      });
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    extensionConfig: state.app.extensions || {},
    downloads: state.persistent.downloads.files,
    downloadPath: downloadPath(state),
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
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
