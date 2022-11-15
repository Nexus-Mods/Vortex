import * as React from 'react';
import { WithTranslation } from 'react-i18next';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

import { showUsageInstruction } from '../actions';
import { IState } from '../types/IState';
import { connect, PureComponentEx, translate } from '../util/ComponentEx';
import { IconButton } from './TooltipControls';

export interface IUsageProps {
  infoId: string;
  persistent?: boolean;
  className?: string;
  opaque?: boolean;
}

interface IConnectedProps {
  show: boolean;
}

interface IActionProps {
  onShow: () => void;
  onHide: () => void;
}

type IProps = IUsageProps & IConnectedProps & IActionProps & WithTranslation;

class Usage extends PureComponentEx<IProps, { }> {
  public render(): JSX.Element {
    const { t, persistent, show, opaque } = this.props;

    const classes = ['usage-instructions'];
    if (!opaque) {
      classes.push('usage-instructions-transparent');
    }
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

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>,
                            ownProps: IUsageProps): IActionProps {
  const { infoId } = ownProps;
  return {
    onShow: () => { dispatch(showUsageInstruction(infoId, true)); },
    onHide: () => { dispatch(showUsageInstruction(infoId, false)); },
  };
}

export default translate(['common'])(
  connect(mapStateToProps, mapDispatchToProps)(
    Usage)) as React.ComponentClass<IUsageProps>;
