import * as PropTypes from 'prop-types';
import * as React from 'react';
import { Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle } from 'react-bootstrap';

class MyModal extends React.PureComponent<typeof Modal.prototype.props, {}> {
  public static Header: typeof ModalHeader = Modal.Header;
  public static Title: typeof ModalTitle = Modal.Title;
  public static Body: typeof ModalBody = Modal.Body;
  public static Footer: typeof ModalFooter = Modal.Footer;

  public static childContextTypes: React.ValidationMap<any> = {
    menuLayer: PropTypes.object,
  };

  private mMenuLayer: Element;

  public getChildContext(): any {
    return { ...this.context, menuLayer: this.mMenuLayer };
  }

  public render(): JSX.Element {
    return (
      <div className='modal-container'>
        <div className='menu-layer' ref={this.setMenuLayer}/>
        <Modal {...this.props} />
      </div>
    );
  }

  private setMenuLayer = (ref: Element) => {
    this.mMenuLayer = ref;
  }
}

export default MyModal;
