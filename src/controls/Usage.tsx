import * as React from 'react';
import * as Redux from 'redux';
import { IState } from '../types/IState';
import { connect, PureComponentEx, translate } from '../util/ComponentEx';
import { ThunkDispatch } from 'redux-thunk';
import { showUsageInstruction } from '../actions';
import { IconButton } from './TooltipControls';

export interface IUsageProps {
  infoId: string;
  persistent?: boolean;
  className?: string;
}

interface IConnectedProps {
  show: boolean;
}

interface IActionProps {
  onShow: () => void;
  onHide: () => void;
}

type IProps = IUsageProps & IConnectedProps & IActionProps;

class Usage extends PureComponentEx<IProps, { }> {
  public render(): JSX.Element {
    const { t, persistent, show } = this.props;

    const classes = ['usage-instructions'];
    classes.push(show ? 'usage-instructions-show' : 'usage-instructions-hide');
    if (this.props.className !== undefined) {
      classes.push(...this.props.className.split(' '));
    }

    if (show) {
      return (
        <div className={classes.join(' ')}>
          <div className='usage-instructions-content'>
            <div>{this.props.children}</div>
          </div>
          <IconButton
            className='close-button'
            id='btn-close-login'
            onClick={this.props.onHide}
            tooltip={t('Close')}
            icon='close'
          />
        </div>
      );
    } else if (persistent) {
      return (
        <div className={classes.join(' ')} onClick={this.props.onShow}>
          {t('Show Usage Instructions')}
        </div>
      );
    } else {
      return null;
    }
  }
}

function mapStateToProps(state: IState, ownProps: IUsageProps): IConnectedProps {
  return {
    show: state.settings.interface.usage[ownProps.infoId] !== false,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>, ownProps: IUsageProps): IActionProps {
  const { infoId } = ownProps;
  return {
    onShow: () => { dispatch(showUsageInstruction(infoId, true)) },
    onHide: () => { dispatch(showUsageInstruction(infoId, false)) }
  };
}

export default translate(['common'], { wait: false })(connect(mapStateToProps, mapDispatchToProps)(Usage)) as React.ComponentClass<IUsageProps>;
