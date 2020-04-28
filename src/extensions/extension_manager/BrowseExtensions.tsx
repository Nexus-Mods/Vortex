import FlexLayout from '../../controls/FlexLayout';
import FormInput from '../../controls/FormInput';
import Icon from '../../controls/Icon';
import Modal from '../../controls/Modal';
import Spinner from '../../controls/Spinner';
import { IconButton } from '../../controls/TooltipControls';
import ZoomableImage from '../../controls/ZoomableImage';
import { IState } from '../../types/IState';
import bbcode from '../../util/bbcode';
import { ComponentEx, connect, translate } from '../../util/ComponentEx';
import opn from '../../util/opn';

import { IAvailableExtension, IExtension, ISelector } from './types';
import { downloadAndInstallExtension, selectorMatch } from './util';

import { app, remote } from 'electron';
import * as React from 'react';
import { Button, ListGroup, ListGroupItem, ModalHeader } from 'react-bootstrap';
import * as semver from 'semver';

const NEXUS_MODS_URL: string = 'http://nexusmods.com/site/mods/';

export interface IBrowseExtensionsProps {
  visible: boolean;
  onHide: () => void;
  localState: {
    reloadNecessary: boolean,
  };
  updateExtensions: () => void;
  onRefreshExtensions: () => void;
}

interface IBrowseExtensionsState {
  error: Error;
  selected?: ISelector;
  installing: string[];
  searchTerm: string;
}

function makeSelectorId(ext: IAvailableExtension): string {
  if (ext.modId !== undefined) {
    return `${ext.modId}`;
  } else {
    return `${ext.github}/${ext.githubRawPath}`;
  }
}

interface IConnectedProps {
  availableExtensions: IAvailableExtension[];
  extensions: { [extId: string]: IExtension };
  updateTime: number;
  language: string;
}

type IProps = IBrowseExtensionsProps & IConnectedProps;

const version = (() => {
  let result: string;

  return () => {
    if (result === undefined) {
      const electronApp = remote !== undefined ? remote.app : app;
      result = electronApp.getVersion();
    }

    return result;
  };
})();

function nop() {
  // nop
}

class BrowseExtensions extends ComponentEx<IProps, IBrowseExtensionsState> {
  private mModalRef: React.RefObject<any>;
  constructor(props: IProps) {
    super(props);

    this.initState({
      error: undefined,
      selected: undefined,
      installing: [],
      searchTerm: '',
    });

    this.mModalRef = React.createRef();
  }

  public render() {
    const { t, availableExtensions, language, onHide,
            onRefreshExtensions, updateTime, visible } = this.props;
    const { searchTerm, selected } = this.state;

    const ext = (selected === undefined)
      ? null
      : availableExtensions.find(iter => selectorMatch(iter, selected));

    const updatedAt = new Date(updateTime);

    return (
      <Modal id='browse-extensions-dialog' show={visible} onHide={nop} ref={this.mModalRef}>
        <ModalHeader>
          <h3>{t('Browse Extensions')}</h3>
        </ModalHeader>
        <Modal.Body>
          <FlexLayout type='row'>
            <FlexLayout.Fixed className='extension-list'>
              <FlexLayout type='column'>
                <FormInput
                  id='browse-extensions-search'
                  label={t('Search')}
                  placeholder={t('Search')}
                  value={searchTerm}
                  onChange={this.changeSearch}
                  debounceTimer={200}
                />
                <ListGroup>
                  {availableExtensions
                    .filter(this.filterSearch)
                    .sort(this.extensionSort)
                    .map(this.renderListEntry)}
                </ListGroup>
                <div className='extension-list-time'>
                  {t('Last updated: {{time}}',
                    { replace: { time: updatedAt.toLocaleString(language) } })}
                  <IconButton icon='refresh' tooltip={t('Refresh')} onClick={onRefreshExtensions} />
                </div>
              </FlexLayout>
            </FlexLayout.Fixed>
            <FlexLayout.Flex fill={true}>
              {(selected === undefined) ? null : this.renderDescription(ext)}
            </FlexLayout.Flex>
          </FlexLayout>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={onHide}>{t('Close')}</Button>
        </Modal.Footer>
      </Modal>
    );
  }

  private changeSearch = (newValue: string) => {
    this.nextState.searchTerm = newValue;
  }

  private filterSearch = (test: IAvailableExtension)  => {
    const { searchTerm } = this.state;
    if (searchTerm.length === 0) {
      return true;
    }

    return (test.name.indexOf(searchTerm) !== -1)
        || (test.author.indexOf(searchTerm) !== -1)
        || (test.description.short.indexOf(searchTerm) !== -1)
        || (test.description.long.indexOf(searchTerm) !== -1);
  }

  private extensionSort = (lhs: IAvailableExtension, rhs: IAvailableExtension): number => {
    return lhs.name.localeCompare(rhs.name);
  }

  private isCompatible(ext: IAvailableExtension): boolean {
    if ((ext.dependencies === undefined)
        || (ext.dependencies['vortex'] === undefined)
        || (process.env.NODE_ENV === 'development')) {
      return true;
    }

    return semver.satisfies(version(), ext.dependencies['vortex']);
  }

  private isInstalled(ext: IAvailableExtension): boolean {
    const { extensions } = this.props;

    return Object.values(extensions)
      .find(iter => ((ext.modId !== undefined) && (iter.modId === ext.modId))
                 || (iter.name === ext.name)) !== undefined;
  }

  private renderListEntry = (ext: IAvailableExtension, idx: number) => {
    const { t } = this.props;
    const { installing, selected } = this.state;

    const classes = ['extension-item'];

    if (selectorMatch(ext, selected)) {
      classes.push('selected');
    }

    const installed = this.isInstalled(ext);
    const incompatible = !this.isCompatible(ext);

    const action = (installing.indexOf(ext.name) !== -1)
      ? <Spinner />
      : installed
        ? <div>{t('Installed')}</div>
        : incompatible
        ? <div>{t('Incompatible')}</div>
        : (
          <a
            className='extension-subscribe'
            data-modid={ext.modId}
            data-github={ext.github}
            data-githubrawpath={ext.githubRawPath}
            onClick={this.install}
          >
            {t('Install')}
          </a>
        );

    return (
      <ListGroupItem
        className={classes.join(' ')}
        key={makeSelectorId(ext)}
        data-modid={ext.modId}
        data-github={ext.github}
        data-githubrawpath={ext.githubRawPath}
        onClick={this.select}
        disabled={installed || incompatible}
      >
        <div className='extension-header'>
          <div>
            <span className='extension-name'>{ext.name}</span>
            <span className='extension-version'>{ext.version}</span>
          </div>
          <div className='extension-stats'>
            {ext.downloads !== undefined
              ? (
                <div className='extension-downloads'>
                  <Icon name='download' />
                  {' '}{ext.downloads}
                </div>
              ) : null
            }
            {ext.endorsements !== undefined
              ? (
                <div className='extension-endorsements'>
                  <Icon name='endorse-yes' />
                  {' '}{ext.endorsements}
                </div>
              ) : null
            }
          </div>
        </div>
        <div className='extension-description'>{ext.description.short}</div>
        <div className='extension-footer'>
          <div className='extension-author'>{ext.author}</div>
          {action}
        </div>
      </ListGroupItem>
    );
  }

  private renderDescription = (ext: IAvailableExtension) => {
    const { t } = this.props;
    const { installing } = this.state;
    if (ext === undefined) {
      return null;
    }

    const installed = this.isInstalled(ext);

    const action = (installing.indexOf(ext.name) !== -1)
      ? <Spinner />
      : installed
        ? <div>{t('Installed')}</div>
        : (
          <a
            className='extension-subscribe'
            data-modid={ext.modId}
            data-github={ext.github}
            data-githubrawpath={ext.githubRawPath}
            onClick={this.install}
          >
            {t('Install')}
          </a>
        );

    return (
      <FlexLayout type='column'>
        <FlexLayout.Fixed>
          <FlexLayout type='row' className='description-header' fill={false}>
            <FlexLayout.Fixed>
              <div className='description-image-container'>
                <ZoomableImage
                  className='extension-picture'
                  url={ext.image}
                />
              </div>
            </FlexLayout.Fixed>
            <FlexLayout.Flex>
              <FlexLayout type='column' className='description-header-content'>
                <div className='description-title'>
                  <span className='description-name'>{ext.name}</span>
                  <span className='description-author'>{t('by')}{' '}{ext.author}</span>
                </div>
                <div className='description-short'>
                  {ext.description.short}
                </div>
                <div className='description-actions'>
                  {action}
                  {' '}
                  <a
                    className='extension-browse'
                    data-modid={ext.modId}
                    data-github={ext.github}
                    data-githubrawpath={ext.githubRawPath}
                    onClick={this.openPage}
                  >
                    <Icon name='open-in-browser' />
                    {t('Open in Browser')}
                  </a>
                </div>
              </FlexLayout>
            </FlexLayout.Flex>
          </FlexLayout>
        </FlexLayout.Fixed>
        <FlexLayout.Flex>
          <div className='description-text'>
            {bbcode(ext.description.long)}
          </div>
        </FlexLayout.Flex>
      </FlexLayout>
    );
  }

  private install = (evt: React.MouseEvent<any>) => {
    const { availableExtensions } = this.props;

    const modIdStr = evt.currentTarget.getAttribute('data-modid');
    const modId = modIdStr !== null ? parseInt(modIdStr, 10) : undefined;
    const github = evt.currentTarget.getAttribute('data-github');
    const githubRawPath = evt.currentTarget.getAttribute('data-githubrawpath');

    const ext = availableExtensions.find(iter =>
      selectorMatch(iter, { modId, github, githubRawPath }));

    this.nextState.installing.push(ext.name);

    downloadAndInstallExtension(this.context.api, ext)
      .then((success: boolean) => {
        if (success) {
          this.props.updateExtensions();
        }
      })
      .catch(err => {
        this.context.api.showErrorNotification('Failed to install extension', err);
      })
      .finally(() => {
        this.nextState.installing = this.state.installing.filter(name => name !== ext.name);
      });
  }

  private select = (evt: React.MouseEvent<any>) => {
    const modIdStr = evt.currentTarget.getAttribute('data-modid');
    const modId = modIdStr !== null ? parseInt(modIdStr, 10) : undefined;
    const github = evt.currentTarget.getAttribute('data-github');
    const githubRawPath = evt.currentTarget.getAttribute('data-githubrawpath');
    this.nextState.selected = { modId, github, githubRawPath };
  }

  private openPage = (evt: React.MouseEvent<any>) => {
    const { availableExtensions } = this.props;

    const modIdStr = evt.currentTarget.getAttribute('data-modid');
    const modId = modIdStr !== null ? parseInt(modIdStr, 10) : undefined;
    const github = evt.currentTarget.getAttribute('data-github');
    const githubRawPath = evt.currentTarget.getAttribute('data-githubrawpath');

    const ext = availableExtensions.find(iter =>
      selectorMatch(iter, { modId, github, githubRawPath }));
    opn(NEXUS_MODS_URL + ext.modId);
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    availableExtensions: state.session.extensions.available,
    extensions: state.session.extensions.installed,
    updateTime: state.session.extensions.updateTime,
    language: state.settings.interface.language,
  };
}

export default translate(['common'])(
  connect(mapStateToProps)(
    BrowseExtensions));
