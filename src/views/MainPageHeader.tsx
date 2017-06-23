import { IExtensionApi } from '../types/IExtensionContext';
import { IState } from '../types/IState';
import { connect } from '../util/ComponentEx';

import * as PropTypes from 'prop-types';
import * as React from 'react';
import { Portal } from 'react-overlays';

export interface IComponentContext {
  api: IExtensionApi;
  headerPortal: HTMLElement;
  page: string;
}

interface IConnectedProps {
  mainPage: string;
}

type IProps = IConnectedProps;

class MainPageHeader extends React.Component<IProps, {}> {
  public static contextTypes: React.ValidationMap<any> = {
    api: PropTypes.object.isRequired,
    headerPortal: PropTypes.object,
    page: PropTypes.string,
  };

  public context: IComponentContext;

  public shouldComponentUpdate() {
    return true;
  }

  public render(): JSX.Element {
    return (this.props.mainPage === this.context.page) ? (
      <Portal container={this.headerPortal}>
        <div className='mainpage-header'>
          {this.props.children}
        </div>
      </Portal>
    ) : null;
  }

  private headerPortal = () => this.context.headerPortal;
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    mainPage: state.session.base.mainPage,
  };
}

export default connect(mapStateToProps)(
  MainPageHeader) as React.ComponentClass<{}>;
