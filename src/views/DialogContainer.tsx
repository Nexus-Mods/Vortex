import {PropsCallback} from '../types/IExtensionContext';
import {extend} from '../util/ComponentEx';

import * as React from 'react';

interface IExtDialog {
  id: string;
  component: React.ComponentClass<any>;
  props: PropsCallback;
}

export interface IExtendedProps {
  objects: IExtDialog[];
}

type IProps = IExtendedProps;

class DialogContainer extends React.Component<IProps, {}> {
  public render(): JSX.Element {
    const { objects } = this.props;
    return (
      <div>
        {objects.map(this.renderDialog)}
      </div>
    );
  }
  private renderDialog(dialog: IExtDialog): JSX.Element {
    const props = dialog.props !== undefined ? dialog.props() : {};
    return <dialog.component key={dialog.id} {...props} />;
  }
}

function registerDialog(instance, id: string, component: React.ComponentClass<any>,
                        props?: PropsCallback): IExtDialog {
  return { id, component, props };
}

export default extend(registerDialog)(
  DialogContainer) as React.ComponentClass<{}>;
