import {PropsCallback} from '../types/IExtensionContext';
import {extend} from '../util/ComponentEx';

import * as React from 'react';

interface IExtDialog {
  id: string;
  component: React.ComponentClass<any>;
  props: PropsCallback;
}

export interface IBaseProps {
  visibleDialog: string;
  onHideDialog: () => void;
}

export interface IExtendedProps {
  objects: IExtDialog[];
}

type IProps = IBaseProps & IExtendedProps;

class DialogContainer extends React.Component<IProps, {}> {
  public render(): JSX.Element {
    const { objects } = this.props;
    return (
      <div>
        {objects.map(dialog => this.renderDialog(dialog))}
      </div>
    );
  }
  private renderDialog(dialog: IExtDialog): JSX.Element {
    const { onHideDialog, visibleDialog } = this.props;
    const props = dialog.props !== undefined ? dialog.props() : {};
    return (
      <dialog.component
        key={dialog.id}
        visible={dialog.id === visibleDialog}
        onHide={onHideDialog}
        {...props}
      />
    );
  }
}

function registerDialog(instanceProps, id: string, component: React.ComponentClass<any>,
                        props?: PropsCallback): IExtDialog {
  return { id, component, props };
}

export default extend(registerDialog)(
  DialogContainer) as React.ComponentClass<IBaseProps>;
