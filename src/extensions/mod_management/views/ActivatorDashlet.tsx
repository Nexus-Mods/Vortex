import {IState} from '../../../types/IState';
import {ComponentEx, connect} from '../../../util/ComponentEx';

import {IModActivator} from '../types/IModActivator';

import * as React from 'react';
import {Alert} from 'react-bootstrap';

interface IBaseProps {
  t: I18next.TranslationFunction;
  activators: IModActivator[];
}

interface IConnectedProps {
}

type IProps = IBaseProps & IConnectedProps;

/**
 * download speed dashlet
 */
class ActivatorDashlet extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const {t, activators} = this.props;

    const state = this.context.api.store.getState();

    const messages = activators.map(
      (activator) => `${activator.name} - ${t(activator.isSupported(state))}`);

    return (<Alert bsStyle='danger'>
      {t('In the current constellation mods can\'t be activated.')}
      <ul>
        {messages.map((msg) => <li key={msg}>{msg}</li>)}
      </ul>
    </Alert>);
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    speeds: state.persistent.downloads.speedHistory,
    files: state.persistent.downloads.files,
  };
}

export default connect(mapStateToProps)(
  ActivatorDashlet) as React.ComponentClass<{}>;
