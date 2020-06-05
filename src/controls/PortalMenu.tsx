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
        {args => {
          if ((args.props.style !== undefined)
              && (args.props.style.transform !== undefined)) {
            // translate3d causes blurry text on "low-res" screens. Newer popper versions seem to account for that but react-popper still
            // relies on an old version at the time of writing
            const translateMatch = args.props.style.transform.match(/translate3d\((\w+), (\w+), 0\)/);
            if (translateMatch !== undefined) {
              args.props.style.top = translateMatch[2];
              args.props.style.left = translateMatch[1];
              delete args.props.style.transform;
            }
          }
          return (
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
          );
        }}
      </Overlay>
    );
  }
}

export default PortalMenu;
