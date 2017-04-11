import { IExtensionApi } from '../types/IExtensionContext';

import * as React from 'react';

interface IComponentContext {
  api: IExtensionApi;
  selectOverlay: (overlay: JSX.Element) => void;
}

class MainPageOverlay extends React.Component<{}, {}> {
  public static contextTypes: React.ValidationMap<any> = {
    api: React.PropTypes.object.isRequired,
    selectOverlay: React.PropTypes.func.isRequired,
  };

  public context: IComponentContext;

  public render(): JSX.Element {
    this.context.selectOverlay(
      <div>
        {this.props.children}
      </div>);
    return null;
  }
}

export default MainPageOverlay as React.ComponentClass<{}>;
