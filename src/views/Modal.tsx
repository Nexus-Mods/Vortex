import * as PropTypes from 'prop-types';
import * as React from 'react';
import { Modal } from 'react-bootstrap';

class MyModal extends React.PureComponent<any, {}> {
  public static Header = Modal.Header;
  public static Title = Modal.Title;
  public static Body = Modal.Body;
  public static Footer = Modal.Footer;

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
