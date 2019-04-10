import * as React from 'react';

/**
 * This is pointless at this point and could probably be removed, moving the style
 * up to the parent, but I'll have to admit I don't understand 100% how "context" and
 * "manager" work in react-dnd and what changed in its api since we needed this.
 */
class DNDContainer extends React.Component<{ style?: React.CSSProperties }, {}> {

  public render(): JSX.Element {
    const {children, style} = this.props;

    const childCount = React.Children.count(children);
    if (childCount === 0) {
      // should this be reported as an error? it might just be the child Element
      // is disabled/hidden for whatever reason
      return null;
    }

    return (
      <div style={style}>
        {children}
      </div>
    );
  }
}

export default DNDContainer;
