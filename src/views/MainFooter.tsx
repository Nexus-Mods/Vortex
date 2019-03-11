import { PropsCallback } from '../types/IExtensionContext';
import { ComponentEx, extend, translate } from '../util/ComponentEx';

import * as React from 'react';

export interface IBaseProps {
  slim: boolean;
}

interface IFooter {
  id: string;
  component: React.ComponentClass<any>;
  props: PropsCallback;
}

interface IExtendedProps {
  objects: IFooter[];
}

type IProps = IBaseProps & IExtendedProps;

/**
 * Footer on the main window. Can be extended
 * @class MainFooter
 */
class MainFooter extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { objects } = this.props;
    return (
      <div id='main-footer'>
        {objects.map(this.renderFooter)}
      </div>
    );
  }

  private renderFooter = (footer: IFooter): JSX.Element => {
    const { slim } = this.props;
    const props = footer.props !== undefined ? footer.props() : {};
    return <footer.component key={footer.id} slim={slim} {...props} />;
  }
}

function registerFooter(instanceGroup: undefined,
                        id: string,
                        component: React.ComponentClass<any>,
                        props: PropsCallback) {
  return { id, component, props };
}

export default
  translate(['common'])(
    extend(registerFooter)(MainFooter),
  ) as React.ComponentClass<IBaseProps>;
