import { IState } from '../types/IState';
import { ComponentEx, connect } from '../util/ComponentEx';

import * as React from 'react';

interface IConnectedProps {
  advancedMode: boolean;
}

type IProps = IConnectedProps;

/**
 * simple control to present advanced features only if the corresponding settings
 * has been set.
 * This can have one or two children. If there is only one child, this child
 * will be rendered in advanced mode.
 * If there are two, the first will be rendered in advanced mode, the second
 * otherwise.
 *
 * @class Advanced
 * @extends {ComponentEx<IProps, {}>}
 */
class Advanced extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    let control = null;
    if (React.Children.count(this.props.children) === 1) {
      if (this.props.advancedMode) {
        control = React.Children.only(this.props.children);
      }
    } else if (React.Children.count(this.props.children) === 2) {
      control = (this.props.advancedMode)
        ? React.Children.toArray(this.props.children)[0]
        : React.Children.toArray(this.props.children)[1];
    } else {
      throw new Error('Advanced component should always have exactly 2 children');
    }

    if (typeof(control) === 'string') {
      return <span>{control}</span>;
    } else {
      return control;
    }
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    // disabled for now. We make practically no use of the advanced mode so it's just confusing
    // advancedMode: state.settings.interface.advanced,
    advancedMode: true,
  };
}

export default connect(mapStateToProps)(Advanced);
