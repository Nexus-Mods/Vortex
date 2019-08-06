import bbcode from '../../util/bbcode';
import { ComponentEx, connect, translate } from '../../util/ComponentEx';

import * as React from 'react';
import { ListGroup, Modal, ModalHeader, ListGroupItem, Button } from 'react-bootstrap';
import { IState } from '../../types/IState';
import { sanitize, downloadExtension } from './util';
import { IAvailableExtension, IExtension } from './types';
import FlexLayout from '../../controls/FlexLayout';
import Spinner from '../../controls/Spinner';

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

function nop() {}

class BrowseExtensions extends ComponentEx<IProps, IBrowseExtensionsState> {
  constructor(props: IProps) {
    super(props);

    this.initState({
      error: undefined,
      selected: -1,
      installing: [],
    });
  }

  public render() {
    const { t, availableExtensions, onHide, visible } = this.props;
    const { selected } = this.state;

    const ext = selected === -1 ? null : availableExtensions[selected];

    return (
      <Modal id='browse-extensions-dialog' show={visible} onHide={nop}>
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
            <FlexLayout.Flex>
              {(selected === -1) ? null : this.renderDescription(ext, selected) }
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

    const installed = (extensions[sanitize(ext.name)] !== undefined);

    const action = (installing.indexOf(ext.name) !== -1)
      ? <Spinner />
      : installed
        ? <div>{t('Installed')}</div>
        : <a
          className='extension-subscribe'
          data-idx={idx}
          onClick={this.install}
        >
          {t('Install')}
        </a>;

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
          { action }
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

    const installed = (extensions[sanitize(ext.name)] !== undefined);

    const action = (installing.indexOf(ext.name) !== -1)
      ? <Spinner />
      : installed
        ? <div>{t('Installed')}</div>
        : <a
          className='extension-subscribe'
          data-idx={idx}
          onClick={this.install}
        >
          {t('Install')}
        </a>;

    return (
      <>
        <FlexLayout type='row' className='description-header' fill={false}>
          <FlexLayout.Fixed>
            <div className='description-image-container'>
              <img src={ext.image} />
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
        <div className='description-text'>
          {bbcode(ext.description.long)}
        </div>
      </>
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
