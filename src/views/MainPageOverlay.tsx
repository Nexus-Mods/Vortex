import { IExtensionApi } from '../types/IExtensionContext';

import * as PropTypes from 'prop-types';
import * as React from 'react';

interface IComponentContext {
  api: IExtensionApi;
  selectOverlay: (overlay: JSX.Element) => void;
}

class MainPageOverlay extends React.Component<{}, {}> {
  public static contextTypes: React.ValidationMap<any> = {
    api: PropTypes.object.isRequired,
    selectOverlay: PropTypes.func.isRequired,
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
