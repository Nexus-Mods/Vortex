import * as _ from 'lodash';
import * as React from 'react';
import { DropdownButton, SplitButton } from 'react-bootstrap';
import * as ReactDOM from 'react-dom';

export interface IBaseProps {
  split?: boolean;
  container?: Element;
}

export type IProps = IBaseProps & typeof DropdownButton.prototype.props;

/**
 * An enhanced dropdown button that adjusts placement of the popover based on the
 * position within the container, so it doesn't get cut off (as long as the
 * popover isn't larger than half of the container)
 *
 * @class MyDropdownButton
 * @extends {React.Component<IProps, { up: boolean }>}
 */
function MyDropdownButton(props: IProps) {
  const { container } = props;

  const [up, setUp] = React.useState(false);
  const [right, setRight] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const node = React.useRef<Element>();

  const getBounds = React.useCallback(() => {
    return container
      ? container.getBoundingClientRect()
      : {
        top: 0,
        left: 0,
        bottom: window.innerHeight,
        right: window.innerWidth,
        height: window.innerHeight,
        width: window.innerWidth,
      } as any;
  }, [ container ]);

  const onToggle = React.useCallback((isOpen: boolean, evt: React.MouseEvent<any>, metadata) => {
    if (evt?.isDefaultPrevented?.()) {
      return;
    }
    setOpen(isOpen);
    if (isOpen) {
      const bounds = getBounds();
      const nodeBounds = node.current.getBoundingClientRect();
      const newUp = nodeBounds.bottom > (bounds.top + bounds.height / 2);
      const newRight = nodeBounds.right > (bounds.left + bounds.width / 2);
      setUp(newUp);
      setRight(newRight);
    }

    if (props.onToggle) {
      props.onToggle(isOpen, evt, metadata);
    }
  }, [setOpen]);

  const setRef = React.useCallback((newRef) => {
    node.current = ReactDOM.findDOMNode(newRef) as Element;
  }, []);

  const relayProps: any =
    _.omit(props, ['container', 'dropup', 'onToggle', 'split', 'children']);

  const Comp: any = props.split ? SplitButton : DropdownButton;

  return (
    <Comp
      ref={setRef}
      dropup={up}
      pullRight={right}
      open={open}
      onToggle={onToggle}
      {...relayProps}
    >
      {open ? props.children : null}
    </Comp>
  );
}

export default MyDropdownButton;
