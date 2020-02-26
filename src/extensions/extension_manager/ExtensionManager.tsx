import { setDialogVisible } from '../../actions';
import { removeExtension, setExtensionEnabled, setExtensionEndorsed } from '../../actions/app';
import Dropzone, { DropType } from '../../controls/Dropzone';
import FlexLayout from '../../controls/FlexLayout';
import Table, { ITableRowAction } from '../../controls/Table';
import { IExtensionLoadFailure, IExtensionState, IState } from '../../types/IState';
import { ITableAttribute } from '../../types/ITableAttribute';
import { relaunch } from '../../util/commandLine';
import { ComponentEx, connect, translate } from '../../util/ComponentEx';
import { log } from '../../util/log';
import * as selectors from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';
import MainPage from '../../views/MainPage';

import { IDownload } from '../download_management/types/IDownload';
import { SITE_ID } from '../gamemode_management/constants';

import installExtension from './installExtension';
import getTableAttributes from './tableAttributes';
import { IExtension, IExtensionWithState } from './types';

import { EndorsedStatus } from '@nexusmods/nexus-api';
import Promise from 'bluebird';
import * as _ from 'lodash';
import * as path from 'path';
import * as React from 'react';
import { Alert, Button, Panel } from 'react-bootstrap';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

export interface IExtensionManagerProps {
  localState: {
    reloadNecessary: boolean,
  };
  updateExtensions: () => void;
}

interface IConnectedProps {
  extensionConfig: { [extId: string]: IExtensionState };
  downloads: { [dlId: string]: IDownload };
  downloadPath: string;
  loadFailures: { [extId: string]: IExtensionLoadFailure[] };
  extensions: { [extId: string]: IExtension };
}

interface IActionProps {
  onSetExtensionEnabled: (extId: string, enabled: boolean) => void;
  onRemoveExtension: (extId: string) => void;
  onBrowseExtension: () => void;
}

type IProps = IExtensionManagerProps & IConnectedProps & IActionProps;

interface IComponentState {
  oldExtensionConfig: { [extId: string]: IExtensionState };
}

class ExtensionManager extends ComponentEx<IProps, IComponentState> {
  private staticColumns: ITableAttribute[];
  private actions: ITableRowAction[];

  constructor(props: IProps) {
    super(props);

    const { extensions, extensionConfig, onSetExtensionEnabled } = props;

    this.initState({
      oldExtensionConfig: props.extensionConfig,
    });

    this.actions = [
      {
        icon: 'delete',
        title: 'Remove',
        action: this.removeExtension,
        condition: (instanceId: string) => !extensions[instanceId].bundled,
        singleRowAction: true,
      },
    ];

    this.staticColumns = getTableAttributes({
      onSetExtensionEnabled:
        (extName: string, enabled: boolean) => {
          const extId = Object.keys(extensions)
            .find(iter => extensions[iter].name === extName);
          onSetExtensionEnabled(extId, enabled);
        },
      onToggleExtensionEnabled:
        (extName: string) => {
          const extId = Object.keys(extensions)
            .find(iter => extensions[iter].name === extName);
          onSetExtensionEnabled(extId, !getSafe(extensionConfig, [extId, 'enabled'], true));
        },
      onEndorseMod:
        (gameId: string, modIdStr: string, endorseState: EndorsedStatus) => {
          const { api } = this.context;
          const modId: number = parseInt(modIdStr, 10);
          const extId = Object.keys(extensions)
            .find(iter => extensions[iter].modId === modId);

          if (extId === undefined) {
            return;
          }

          api.emitAndAwait('endorse-nexus-mod',
                           SITE_ID, modId, extensions[extId].version, endorseState)
            .then((endorsed: EndorsedStatus[])  => {
              api.store.dispatch(setExtensionEndorsed(extId, endorsed[0]));
            })
            .catch(() => {
              api.store.dispatch(setExtensionEndorsed(extId, 'Undecided'));
            });
        },
    });
  }

  public render(): JSX.Element {
    const {t, extensions, localState, extensionConfig} = this.props;
    const {oldExtensionConfig} = this.state;

    const extensionsWithState = this.mergeExt(extensions, extensionConfig);

    return (
      <MainPage>
        <MainPage.Body>
          <Panel>
            <Panel.Body>
              <FlexLayout type='column'>
                <FlexLayout.Fixed>
                  {
                    localState.reloadNecessary || !_.isEqual(extensionConfig, oldExtensionConfig)
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
                  <FlexLayout type='row'>
                    <FlexLayout.Flex className='extensions-find-button-container'>
                      <div className='flex-center-both'>
                        <Button
                          id='btn-more-extensions'
                          onClick={this.onBrowse}
                          bsStyle='ghost'
                        >
                          {t('Find more')}
                        </Button>
                      </div>
                      </FlexLayout.Flex>
                    <FlexLayout.Flex>
                      <Dropzone
                        accept={['files']}
                        drop={this.dropExtension}
                        dialogHint={t('Select extension file')}
                        icon='folder-download'
                      />
                    </FlexLayout.Flex>
                  </FlexLayout>
                </FlexLayout.Fixed>
              </FlexLayout>
            </Panel.Body>
          </Panel>
        </MainPage.Body>
      </MainPage>
    );
  }

  private onBrowse = () => {
    this.props.onBrowseExtension();
  }

  private dropExtension = (type: DropType, extPaths: string[]): void => {
    const { downloads } = this.props;
    let success = false;
    log('info', 'installing extension(s) via drag and drop', { extPaths });
    const prop: Promise<void[]> = (type === 'files')
      ? Promise.map(extPaths, extPath => installExtension(this.context.api, extPath)
          .then(() => { success = true; })
          .catch(err => {
            this.context.api.showErrorNotification('Failed to install extension', err,
                                                   { allowReport: false });
          }))
      : Promise.map(extPaths, url => new Promise<void>((resolve, reject) => {
        this.context.api.events.emit('start-download', [url], undefined,
                                     (error: Error, id: string) => {
          const dlPath = path.join(this.props.downloadPath, downloads[id].localPath);
          installExtension(this.context.api, dlPath)
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
        this.props.updateExtensions();
      }
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
    relaunch();
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
        const endorsed: EndorsedStatus = getSafe(extensionConfig, [id, 'endorsed'], 'Undecided');
        prev[id] = {
          ...extensions[id],
          enabled,
          endorsed,
          loadFailures: loadFailures[id] || [],
        };
      }
      return prev;
    }, {});
  }

  private removeExtension = (extIds: string[]) => {
    extIds.forEach(extId => {
      const ext = this.props.extensions[extId];
      this.props.onRemoveExtension(path.basename(ext.path || extId));
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
    extensions: state.session.extensions.installed,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onSetExtensionEnabled: (extId: string, enabled: boolean) =>
      dispatch(setExtensionEnabled(extId, enabled)),
    onRemoveExtension: (extId: string) => dispatch(removeExtension(extId)),
    onBrowseExtension: () => dispatch(setDialogVisible('browse-extensions')),
  };
}

export default
  translate(['common'])(
    connect(mapStateToProps, mapDispatchToProps)(
      ExtensionManager));
