import memoizeOne from 'memoize-one';
import * as PropTypes from 'prop-types';
import * as React from 'react';
import { Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle } from 'react-bootstrap';
import { MutexWrapper } from '../util/MutexContext';

class MyModal extends React.PureComponent<typeof Modal.prototype.props, {}> {
  public static Header: typeof ModalHeader = Modal.Header;
  public static Title: typeof ModalTitle = Modal.Title;
  public static Body: typeof ModalBody = Modal.Body;
  public static Footer: typeof ModalFooter = Modal.Footer;

  public static childContextTypes: React.ValidationMap<any> = {
    menuLayer: PropTypes.object,
  };

  private getContainer = memoizeOne(() => this.getContainerImpl());

  private mMenuLayer: Element = null;

  public getChildContext(): any {
    return { ...this.context, menuLayer: this.mMenuLayer };
  }

  public render(): JSX.Element {
    return (
      <div className='modal-container'>
        <MutexWrapper show={this.props.show}>
          <Modal {...this.props} container={this.getContainer()}>
            <div className='menu-layer' ref={this.setMenuLayer}/>
            {this.mMenuLayer !== null ? this.props.children : null}
          </Modal>
        </MutexWrapper>
      </div>
    );
  }

  private getContainerImpl() {
    return document.getElementById('overlays');
  }

  private setMenuLayer = (ref: Element) => {
    this.mMenuLayer = ref;
    this.forceUpdate();
  }
}

export default MyModal;
