import { setOverlayOpen } from '../actions/session';
import { IState } from '../types/IState';
import { ComponentEx, connect, translate } from '../util/ComponentEx';

import { IconButton } from './TooltipControls';

import * as React from 'react';

export interface IBaseProps {
}

interface IActionProps {
  onSetOverlayOpen: (open: boolean) => void;
}

interface IConnectedProps {
  overlayOpen: boolean;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class FunctionsButton extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t} = this.props;

    return (
      <IconButton
        id='btn-open-flyout'
        icon='ellipsis-v'
        tooltip={t('Functions')}
        onClick={this.toggleOverlay}
        className='pull-right'
      />
    );
  }

  private toggleOverlay = () => {
    this.props.onSetOverlayOpen(!this.props.overlayOpen);
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    overlayOpen: state.session.base.overlayOpen,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetOverlayOpen: (open: boolean) => dispatch(setOverlayOpen(open)),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      FunctionsButton)) as React.ComponentClass<IBaseProps>;
