import { IExtensionApi } from '../types/IExtensionContext';
import { IState } from '../types/IState';
import { connect } from '../util/ComponentEx';

import * as PropTypes from 'prop-types';
import * as React from 'react';
import { Portal } from 'react-overlays';

interface IComponentContext {
  api: IExtensionApi;
  overlayPortal: () => HTMLElement;
  page: string;
}

interface IConnectedProps {
  mainPage: string;
}

type IProps = IConnectedProps;

class MainPageOverlay extends React.Component<IProps, {}> {
  public static contextTypes: React.ValidationMap<any> = {
    api: PropTypes.object.isRequired,
    overlayPortal: PropTypes.func,
    page: PropTypes.string,
  };

  public context: IComponentContext;

  public render(): JSX.Element {
    return (this.context.page === this.props.mainPage) ? (
      <Portal container={this.context.overlayPortal}>
        <div>
          {this.props.children}
        </div>
      </Portal>
    ) : null;
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    mainPage: state.session.base.mainPage,
  };
}

export default connect(mapStateToProps)(
  MainPageOverlay) as React.ComponentClass<{}>;
