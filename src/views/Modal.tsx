import * as PropTypes from 'prop-types';
import * as React from 'react';
import * as ReactBootstrap from 'react-bootstrap';

class MyModal extends React.PureComponent<ReactBootstrap.ModalProps, {}> {
  public static Header = ReactBootstrap.Modal.Header;
  public static Title = ReactBootstrap.Modal.Title;
  public static Body = ReactBootstrap.Modal.Body;
  public static Footer = ReactBootstrap.Modal.Footer;

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
        <ReactBootstrap.Modal {...this.props} />
      </div>
    );
  }

  private setMenuLayer = (ref: Element) => {
    this.mMenuLayer = ref;
  }
}

export default MyModal;
