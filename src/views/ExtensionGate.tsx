import { truthy } from '../util/util';

import * as _ from 'lodash';
import * as React from 'react';

/**
 * wraps a control that was added by an extension.
 *
 * This attaches to all objects created with makeReactive, to ensure the wrapped
 * component gets updated when that object changes.
 *
 * TODO: the object created by makeReactive gets mutated (otherwise the proxy that
 *   triggers rerenders wouldn't work). This would cause components to not pick up on
 *   changes to that object if they only compare by reference so this gate creates
 *   copies of those parameters and re-copies them whenever they change (by value).
 *   Thereby the wrapped components work as expected but it defeats the whole point
 *   of shallow comparing props. At some point we should see if we can find a better
 *   solution.
 *
 * @class ExtensionGate
 * @extends {React.Component<{}, {}>}
 */
class ExtensionGate extends React.Component<{}, {}> {
  private mWrappers: { [key: string]: any } = {};
  public componentWillMount() {
    const props = React.Children.only(this.props.children).props;
    Object.keys(props).forEach(key => {
      if (truthy(props[key])
        && (props[key].attach !== undefined)
        && (props[key].detach !== undefined)) {

        if (typeof (props[key]) === 'object') {
          this.mWrappers[key] = { ...props[key] };
        }
        props[key].attach(this);
      }
    });
  }

  public componentWillUnmount() {
    const props = React.Children.only(this.props.children).props;
    Object.keys(props).forEach(key => {
      if (truthy(props[key])
        && (props[key].attach !== undefined)
        && (props[key].detach !== undefined)) {
        props[key].detach(this);
      }
    });
    this.mWrappers = {};
  }

  public render(): JSX.Element {
    this.updateWrappers(React.Children.only(this.props.children).props);
    return React.cloneElement(React.Children.only(this.props.children), this.mWrappers);
  }

  private updateWrappers(props: { [key: string]: any }) {
    Object.keys(this.mWrappers).forEach(key => {
      if (!_.isEqual(this.mWrappers[key], props[key])) {
        this.mWrappers[key] = { ...props[key] };
      }
    });
  }
}

export default ExtensionGate;
