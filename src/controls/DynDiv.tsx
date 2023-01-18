import { IDynDivOptions } from '../types/IDynDivOptions';
import { connect } from '../util/ComponentEx';
import { extend } from '../util/ExtensionProvider';

import * as React from 'react';
import { IExtensibleProps } from '../types/IExtensionProvider';

interface IDynDivDefinition {
  component: React.ComponentClass<any>;
  options: IDynDivOptions;
}

export interface IDynDivProps {
  group: string;
  orientation?: 'horizontal' | 'vertical';
}

interface IExtensionProps {
  objects: IDynDivDefinition[];
}

interface IConnectedProps {}

type IProps = IDynDivProps & IConnectedProps & IExtensionProps & React.HTMLAttributes<any>;

/**
 * A control to contain arbitrary controls added through extensions.
 */
class DynDiv extends React.Component<IProps, {}> {
  public render(): JSX.Element {
    const { group, objects, orientation } = this.props;

    const visible = objects.filter((obj, idx) =>
      (obj.options?.condition === undefined) || obj.options.condition({}));

    const classes = ['dyndiv'];
    if (orientation === 'vertical') {
      classes.push('dyndiv-vertical');
    } else { // default to horizontal
      classes.push('dyndiv-horizontal');
    }

    return (
      <div id={group} className={classes.join(' ')}>
        {visible.map((comp, idx) => this.renderComponent(comp, idx))}
      </div>
    );
  }

  private renderComponent(object: IDynDivDefinition, idx: number) {
    const props = object.options?.props ?? {};
    return <object.component key={idx} {...props} />;
  }
}

function registerDynDiv(instanceGroup: string,
                        group: string,
                        component: React.ComponentClass<any>,
                        options: IDynDivOptions,
                        ): IDynDivDefinition {
  if (instanceGroup === group) {
    return { component, options };
  } else {
    return undefined;
  }
}

function mapStateToProps(): IConnectedProps {
  return {};
}

export type ExportType = IDynDivProps & IExtensibleProps & React.HTMLAttributes<any> & any;

export default
  extend(registerDynDiv, 'group')(
    connect(mapStateToProps)(
      DynDiv) as any) as React.ComponentClass<ExportType>;
