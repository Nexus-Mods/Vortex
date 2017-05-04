import { PropsCallback } from '../types/IExtensionContext';
import { ComponentEx, extend, translate } from '../util/ComponentEx';

import * as React from 'react';
import {  Well } from 'react-bootstrap';
import { Fixed, Flex, Layout } from 'react-layout-pane';

export interface IBaseProps {
}

interface IToolbar {
  id: string;
  component: React.ComponentClass<any>;
  props: PropsCallback;
}

interface IExtendedProps {
  objects: IToolbar[];
}

type IProps = IBaseProps & IExtendedProps;

/**
 * Toolbar on the main window. Can be extended
 * @class MainToolbar
 */
class MainToolbar extends ComponentEx<IProps, {}> {
  constructor(props) {
    super(props);
  }

  public render(): JSX.Element {
    const { objects } = this.props;
    return (
      <Flex>
        {objects.map(this.renderToolbar)}
      </Flex>
    );
  }

  private renderToolbar(toolbar: IToolbar): JSX.Element {
    const props = toolbar.props !== undefined ? toolbar.props() : {};
    return <toolbar.component key={toolbar.id} {...props} />;
  }
}

function registerToolbar(
  instance: MainToolbar,
  id: string,
  component: React.ComponentClass<any>,
  props: PropsCallback) {
  return { id, component, props };
}

export default
  translate(['common'], { wait: false })(
    extend(registerToolbar)(MainToolbar),
  ) as React.ComponentClass<IBaseProps>;
