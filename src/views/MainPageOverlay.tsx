import * as React from 'react';

interface IComponentContext {
  page: { overlayOpen: boolean };
}

class MainPageOverlay extends React.Component<{}, {}> {
  public static contextTypes: React.ValidationMap<any> = {
    page: React.PropTypes.shape({
      overlayOpen: React.PropTypes.bool.isRequired,
    }),
  };

  public context: IComponentContext;

  public render(): JSX.Element {
    let classes = [ 'overlay' ];
    if (this.context.page.overlayOpen) {
      classes.push('in');
    }
    return <div className={classes.join(' ')}>
      {this.props.children}
    </div>;
  }
}

export default MainPageOverlay as React.ComponentClass<{}>;
