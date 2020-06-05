import * as _ from 'lodash';
import * as React from 'react';

function ignoreFunction(lhs: any, rhs: any): boolean {
  if (_.isFunction(lhs)) {
    return true;
  }
  return undefined;
}

export interface IBaseProps {
  dynamicProps: () => any;
  staticProps: any;
  component: React.ComponentClass<any> | React.StatelessComponent<any>;
}

/**
 * a hack to ensure a component gets rerendered when dynamic props
 * change even though we have no even to react to when that happens.
 * TODO: This is ugly polling, can we find a better way without
 *   uglifying the api for the user?
 *
 * @class DynamicProps
 * @extends {React.Component<any, {}>}
 */
class DynamicProps extends React.Component<IBaseProps, {}> {
  private mLastProps: any = {};

  public componentDidMount() {
    this.mLastProps = this.props.dynamicProps();
    listeners.push(this);
    if (listeners.length === 1) {
      refreshListeners();
    } else {
      this.refreshProps();
    }
  }

  public componentWillUnmount() {
    const idx = listeners.indexOf(this);
    if (idx !== -1) {
      listeners.splice(idx, 1);
    }
  }

  public refreshProps() {
    const props = this.props.dynamicProps();

    if (!_.isEqualWith(props, this.mLastProps, ignoreFunction)) {
      this.mLastProps = props;
      this.setState({});
    }
  }

  public render(): JSX.Element {
    return (
      <this.props.component {...this.props.staticProps} {...this.mLastProps}>
        {this.props.children}
      </this.props.component>
    );
  }
}

const listeners: DynamicProps[] = [];

function refreshListeners() {
  listeners.forEach(listener => listener.refreshProps());
  if (listeners.length > 0) {
    setTimeout(refreshListeners, 500);
  }
}

export default DynamicProps;
