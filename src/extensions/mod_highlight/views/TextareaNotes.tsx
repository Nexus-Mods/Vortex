import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { getSafe } from '../../../util/storeHelper';

import { setModAttribute } from '../../mod_management/actions/mods';
import { IMod } from '../../mod_management/types/IMod';

import * as React from 'react';

export interface IBaseProps {
  mod: IMod;
  gameMode: string;
}

interface IActionProps {
  onSetModAttribute: (gameMode: string, modId: string, attributeId: string, value: any) => void;
}

export interface IMainWindowState {
  showLayer: string;
  showPage: string;
}

interface IConnectedProps {
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

/**
 * Textarea Notes
 * 
 * @class TextareaNotes
 */
class TextareaNotes extends ComponentEx<IProps, IMainWindowState> {

  constructor(props: IProps) {
    super(props);

    this.state = {
      showLayer: '',
      showPage: '',
    };
  }

  public render(): JSX.Element {
    let {mod } = this.props;
    let notes = getSafe(mod.attributes, ['notes'], '');

    return (
      <textarea
          value={notes}
          id={mod.id}
          style={{ width: '100%', minHeight: 200, resize: 'none' }}
          onChange={this.handleChange}
      />
    );
  }

  private handleChange = (event) => {
    let {gameMode, onSetModAttribute } = this.props;
    onSetModAttribute(gameMode, event.currentTarget.id, 'notes', event.currentTarget.value);
  }

}

function mapStateToProps(state: IState): IConnectedProps {
  return {};
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetModAttribute: (gameMode: string, modId: string, attributeId: string, value: any) => {
      dispatch(setModAttribute(gameMode, modId, attributeId, value));
    },
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(TextareaNotes)
  ) as React.ComponentClass<IBaseProps>;
