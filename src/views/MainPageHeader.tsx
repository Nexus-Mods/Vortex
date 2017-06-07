import { IExtensionApi } from '../types/IExtensionContext';

import * as PropTypes from 'prop-types';
import * as React from 'react';

interface IComponentContext {
  api: IExtensionApi;
  selectHeader: (overlay: JSX.Element) => void;
}

class MainPageHeader extends React.Component<{}, {}> {
  public static contextTypes: React.ValidationMap<any> = {
    api: PropTypes.object.isRequired,
    selectHeader: PropTypes.func.isRequired,
  };

  public context: IComponentContext;

  public render(): JSX.Element {
    this.context.selectHeader(
      <div className='mainpage-header'>
        {this.props.children}
      </div>);
    return null;
  }
}

export default MainPageHeader;
