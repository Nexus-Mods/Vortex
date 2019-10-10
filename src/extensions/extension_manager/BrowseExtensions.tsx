import FlexLayout from '../../controls/FlexLayout';
import Modal from '../../controls/Modal';
import Spinner from '../../controls/Spinner';
import ZoomableImage from '../../controls/ZoomableImage';
import { IState } from '../../types/IState';
import bbcode from '../../util/bbcode';
import { ComponentEx, connect, translate } from '../../util/ComponentEx';

import { IAvailableExtension, IExtension } from './types';
import { downloadExtension } from './util';

import * as React from 'react';
import { Button, ListGroup, ListGroupItem, ModalHeader } from 'react-bootstrap';

export interface IBrowseExtensionsProps {
  visible: boolean;
  onHide: () => void;
  localState: {
    reloadNecessary: boolean,
  };
  updateExtensions: () => void;
}

interface IBrowseExtensionsState {
  error: Error;
  selected: number;
  installing: string[];
}

interface IConnectedProps {
  availableExtensions: IAvailableExtension[];
  extensions: { [extId: string]: IExtension };
}

type IProps = IBrowseExtensionsProps & IConnectedProps;

function nop() {
  // nop
}

class BrowseExtensions extends ComponentEx<IProps, IBrowseExtensionsState> {
  private mModalRef: React.RefObject<any>;
  constructor(props: IProps) {
    super(props);

    this.initState({
      error: undefined,
      selected: -1,
      installing: [],
    });

    this.mModalRef = React.createRef();
  }

  public render() {
    const { t, availableExtensions, onHide, visible } = this.props;
    const { selected } = this.state;

    const ext = selected === -1 ? null : availableExtensions[selected];

    return (
      <Modal id='browse-extensions-dialog' show={visible} onHide={nop} ref={this.mModalRef}>
        <ModalHeader>
          <h3>{t('Browse Extensions')}</h3>
        </ModalHeader>
        <Modal.Body>
          <FlexLayout type='row'>
            <FlexLayout.Fixed className='extension-list'>
              <ListGroup>
                {availableExtensions.map(this.renderListEntry)}
              </ListGroup>
            </FlexLayout.Fixed>
            <FlexLayout.Flex fill={true}>
              {(selected === -1) ? null : this.renderDescription(ext, selected)}
            </FlexLayout.Flex>
          </FlexLayout>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={onHide}>{t('Close')}</Button>
        </Modal.Footer>
      </Modal>);
  }

  private renderListEntry = (ext: IAvailableExtension, idx: number) => {
    const { t, extensions } = this.props;
    const { installing, selected } = this.state;

    const classes = ['extension-item'];

    if (idx === selected) {
      classes.push('selected');
    }

    const installed = Object.values(extensions).find(iter => iter.name === ext.name) !== undefined;

    const action = (installing.indexOf(ext.name) !== -1)
      ? <Spinner />
      : installed
        ? <div>{t('Installed')}</div>
        : (
          <a
            className='extension-subscribe'
            data-idx={idx}
            onClick={this.install}
          >
            {t('Install')}
          </a>
        );

    return (
      <ListGroupItem
        className={classes.join(' ')}
        key={ext.modId}
        data-idx={idx}
        onClick={this.select}
        disabled={installed}
      >
        <div className='extension-header'>
          <span className='extension-name'>{ext.name}</span>
          <span className='extension-version'>{ext.version}</span>
        </div>
        <div className='extension-description'>{ext.description.short}</div>
        <div className='extension-footer'>
          <div className='extension-author'>{ext.author}</div>
          {action}
        </div>
      </ListGroupItem>
    );
  }

  private renderDescription = (ext: IAvailableExtension, idx: number) => {
    const { t, extensions } = this.props;
    const { installing } = this.state;
    if (ext === undefined) {
      return null;
    }

    const installed = Object.values(extensions).find(iter => iter.name === ext.name) !== undefined;

    const action = (installing.indexOf(ext.name) !== -1)
      ? <Spinner />
      : installed
        ? <div>{t('Installed')}</div>
        : (
          <a
            className='extension-subscribe'
            data-idx={idx}
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
    const idx = parseInt(evt.currentTarget.getAttribute('data-idx'), 10);
    const ext = availableExtensions[idx];

    this.nextState.installing.push(ext.name);

    downloadExtension(this.context.api, ext)
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
    const idx = evt.currentTarget.getAttribute('data-idx');
    this.nextState.selected = parseInt(idx, 10);
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    availableExtensions: state.session.extensions.available,
    extensions: state.session.extensions.installed,
  };
}

export default translate(['common'])(
  connect(mapStateToProps)(
    BrowseExtensions));
