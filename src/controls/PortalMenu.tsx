import Dropdown from './Dropdown';

import * as PropTypes from 'prop-types';
import * as React from 'react';
import { Overlay } from 'react-overlays';

interface IPortalMenuProps {
  open: boolean;
  target: JSX.Element;
  onClick: (evt) => void;
  onClose: () => void;
  bsRole?: string;
}

class PortalMenu extends React.Component<IPortalMenuProps, {}> {
  public static contextTypes: React.ValidationMap<any> = {
    menuLayer: PropTypes.object,
  };

  public context: { menuLayer: JSX.Element };

  public render() {
    const { onClick, onClose, open, target } = this.props;

    return (
      <Overlay
        show={open}
        container={this.context.menuLayer}
        placement='bottom'
        target={target}
        flip={true}
        popperConfig={{
          modifiers: {
            preventOverflow: {
              boundariesElement: 'window',
            },
          },
        }}
      >
        {args => (
            <div {...args.props} className='icon-menu-positioner'>
              <div className='menu-content'>
                <Dropdown.Menu
                  style={{ display: 'block', position: 'initial' }}
                  onClose={onClose}
                  open={open}
                  onClick={onClick}
                >
                  {this.props.children}
                </Dropdown.Menu>
              </div>
            </div>
          )}
      </Overlay>
    );
  }
}

export default PortalMenu;
