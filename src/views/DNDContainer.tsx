import { DragDropManager, createDragDropManager } from 'dnd-core';
import * as PropTypes from 'prop-types';
import * as React from 'react';
import HTML5Backend from 'react-dnd-html5-backend';

let globalDNDManager: DragDropManager<any>;

function getContext(): DragDropManager<any> {
  if (globalDNDManager === undefined) {
    globalDNDManager = createDragDropManager(HTML5Backend, undefined);
  }
  
  return globalDNDManager;
}

class DNDContainer extends React.Component<{ style?: React.CSSProperties }, {}> {
  public static childContextTypes: React.ValidationMap<any> = {
    dragDropManager: PropTypes.object.isRequired,
  };

  public getChildContext() {
    return {
      dragDropManager: getContext(),
    };
  }

  public render(): JSX.Element {
    const {children, style} = this.props;

    const childCount = React.Children.count(children);
    if (childCount === 0) {
      // should this be reported as an error? it might just be the child Element
      // is disabled/hidden for whatever reason
      return null;
    }

    return <div style={style}>{children}</div>;
  }
}

export default DNDContainer;
