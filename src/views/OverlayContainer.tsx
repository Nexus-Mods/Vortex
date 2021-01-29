import ErrorBoundary from '../controls/ErrorBoundary';
import {PropsCallback} from '../types/IExtensionContext';
import {extend} from '../util/ComponentEx';

import * as React from 'react';
import ExtensionGate from '../controls/ExtensionGate';

interface IExtOverlay {
  id: string;
  component: React.ComponentType<any>;
  props: PropsCallback;
}

export interface IBaseProps {
}

export interface IExtendedProps {
  objects: IExtOverlay[];
}

type IProps = IBaseProps & IExtendedProps;

class OverlayContainer extends React.Component<IProps, {}> {
  public render(): JSX.Element {
    const { objects } = this.props;
    return (
      <div>
        {objects.map(dialog => this.renderOverlay(dialog))}
      </div>
    );
  }
  private renderOverlay(overlay: IExtOverlay): JSX.Element {
    const props = overlay.props !== undefined ? overlay.props() : {};
    return (
      <ErrorBoundary
        key={overlay.id}
        className='errorboundary-overlay'
      >
        <ExtensionGate id={overlay.id}>
          <overlay.component
            {...props}
          />
        </ExtensionGate>
      </ErrorBoundary>
    );
  }
}

function registerOverlay(instanceGroup: undefined, id: string, component: React.ComponentClass<any>,
                        props?: PropsCallback): IExtOverlay {
  return { id, component, props };
}

export default extend(registerOverlay)(
  OverlayContainer) as React.ComponentClass<IBaseProps>;
