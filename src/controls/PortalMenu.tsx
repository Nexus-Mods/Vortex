import Dropdown from './Dropdown';

import * as PropTypes from 'prop-types';
import * as React from 'react';
import { Overlay } from 'react-overlays';
import { SelectCallback } from 'react-bootstrap';

interface IPortalMenuProps {
  open: boolean;
  target: Element;
  onClick: (evt) => void;
  onClose: () => void;
  onSelect?: SelectCallback;
  useMousePosition?: boolean | { x: number, y: number };
  bsRole?: string;
}

class PortalMenu extends React.Component<IPortalMenuProps, { x: number, y: number }> {
  public static contextTypes: React.ValidationMap<any> = {
    menuLayer: PropTypes.object,
  };

  public context: { menuLayer: JSX.Element };

  constructor(props: IPortalMenuProps) {
    super(props);

    this.state = {
      x: 0,
      y: 0,
    }
  }

  public render() {
    const { onClose, open, target, useMousePosition } = this.props;

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
          try {
            if (useMousePosition === true) {
              args.props.style.top = this.state.y;
              args.props.style.left = this.state.x;
              delete args.props.style.transform;
            } else if (!!useMousePosition) {
              args.props.style.top = useMousePosition.y;
              args.props.style.left = useMousePosition.x;
              delete args.props.style.transform;
            } else if ((args.props.style !== undefined)
              && (args.props.style.transform !== undefined)) {
              // translate3d causes blurry text on "low-res" screens.
              // Newer popper versions seem to account for that but react-popper still
              // relies on an old version at the time of writing
              const translateMatch =
                args.props.style.transform.match(/translate3d\((\w+), (\w+), 0\)/);
              if (translateMatch !== undefined) {
                args.props.style.top = translateMatch[2];
                args.props.style.left = translateMatch[1];
                delete args.props.style.transform;
              }
            }
          } catch (err) {
            // nop, wtf is going on here?
          }
          return (
            <div {...args.props} className='icon-menu-positioner'>
              <div className='menu-content'>
                <Dropdown.Menu
                  style={{ display: 'block', position: 'initial' }}
                  onClose={onClose}
                  open={open}
                  onClick={this.onClick}
                  onSelect={this.props.onSelect}
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

  private onClick = (evt: React.MouseEvent<any>) => {
    if (this.props.useMousePosition === true) {
      this.setState({ x: evt.clientX, y: evt.clientY });
    }
    this.props.onClick(evt);
  }
}

export default PortalMenu;
