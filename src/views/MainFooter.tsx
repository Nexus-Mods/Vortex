import { PropsCallback } from '../types/IExtensionContext';
import { ComponentEx, extend, translate } from '../util/ComponentEx';

import * as React from 'react';
import { Well } from 'react-bootstrap';

export interface IBaseProps {
}

interface IFooter {
  id: string;
  component: React.ComponentClass<any>;
  props: () => PropsCallback;
}

interface IExtendedProps {
  objects: IFooter[];
}

type IProps = IBaseProps & IExtendedProps;

/**
 * Footer on the main window. Can be extended
 * 
 * @class MainFooter
 */
class MainFooter extends ComponentEx<IProps, {}> {
  constructor(props) {
    super(props);
  }

  public render(): JSX.Element {
    const { objects } = this.props;
    return (
      <Well bsStyle='slim'>
        { objects.map(this.renderFooter) }
      </Well>
    );
  }

  private renderFooter(footer: IFooter): JSX.Element {
    let props = footer.props !== undefined ? footer.props() : {};
    return <footer.component key={ footer.id } {...props} />;
  }
}

function registerFooter(instance: MainFooter,
                        id: string,
                        component: React.ComponentClass<any>,
                        props: () => PropsCallback) {
  return { id, component, props };
}

export default
  translate(['common'], { wait: true })(
    extend(registerFooter)(MainFooter)
  ) as React.ComponentClass<IBaseProps>;
