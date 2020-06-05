import { log } from '../util/log';
import { truthy } from '../util/util';
import { Icon } from './TooltipControls';

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
class ExtensionGate extends React.Component<{ id: string }, {}> {
  private mWrappers: { [key: string]: any } = {};
  private mValid: boolean;

  public componentWillUnmount() {
    if (this.mValid) {
      const props = (React.Children.only(this.props.children) as React.ReactElement<any>).props;
      Object.keys(props).forEach(key => {
        if (truthy(props[key])
          && (props[key].attach !== undefined)
          && (props[key].detach !== undefined)) {
          props[key].detach(this);
        }
      });
      this.mWrappers = {};
    }
  }

  public render(): JSX.Element {
    if (React.Children.count(this.props.children) === 0) {
      return null;
    }

    if (this.mValid === undefined) {
      this.initialize();
    }

    if (!this.mValid) {
      return (
        <Icon
          id={this.props.id}
          tooltip='Extension failed to render'
          name='extension-render-failed'
        />
      );
    }
    this.updateWrappers(
      (React.Children.only(this.props.children) as React.ReactElement<any>).props);
    return React.cloneElement(React.Children.only(this.props.children) as React.ReactElement<any>,
                              this.mWrappers);
  }

  private initialize() {
    if (React.Children.count(this.props.children) === 0) {
      return;
    }
    try {
      const props = (React.Children.only(this.props.children) as React.ReactElement<any>).props;
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
      this.mValid = true;
    } catch (err) {
      log('warn', 'failed to mount extension control', { err });
      this.mValid = false;
    }
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
