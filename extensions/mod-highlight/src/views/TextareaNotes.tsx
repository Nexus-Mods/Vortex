import { actions, ComponentEx, Icon, selectors, tooltip, types, util } from 'nmm-api';
import * as React from 'react';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';

export interface IBaseProps {
  mod: types.IMod;
  gameMode: string;
}

interface IActionProps {
  onSetModAttribute: (gameMode: string, modId: string, attributeId: string, value: any) => void;
}

interface IConnectedProps {
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

interface IComponentState {
  valueCache: string;
}

/**
 * Textarea Notes
 *
 * @class TextareaNotes
 */
class TextareaNotes extends ComponentEx<IProps, IComponentState> {
  private mDebouncer: util.Debouncer;
  constructor(props: IProps) {
    super(props);

    this.initState({
      valueCache: util.getSafe(props.mod.attributes, ['notes'], ''),
    });

    this.mDebouncer = new util.Debouncer((newNote: string) => {
      const { gameMode, mod, onSetModAttribute } = this.props;
      this.props.onSetModAttribute(gameMode, mod.id, 'notes', newNote);
      return null;
    }, 250);
  }

  public shouldComponentUpdate(nextProps: IProps, nextState: IComponentState) {
    return this.props.mod.id !== nextProps.mod.id
        || this.props.gameMode !== nextProps.gameMode
        || this.state !== nextState;
  }

  public render(): JSX.Element {
    const { t, mod } = this.props;
    const { valueCache } = this.state;

    return (
      <textarea
        value={valueCache}
        id={mod.id}
        className='textarea-notes'
        onChange={this.handleChange}
        placeholder={t('Write your own notes on this mod')}
      />
    );
  }

  private handleChange = (event) => {
    const {gameMode, onSetModAttribute } = this.props;

    const newValue = event.currentTarget.value;

    this.nextState.valueCache = newValue;
    this.mDebouncer.schedule(undefined, newValue);
  }
}

function mapStateToProps(state: types.IState): IConnectedProps {
  return {};
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetModAttribute: (gameMode: string, modId: string, attributeId: string, value: any) => {
      dispatch(actions.setModAttribute(gameMode, modId, attributeId, value));
    },
  };
}

export default
translate(['common'], { wait: false })(
  connect(mapStateToProps, mapDispatchToProps)(
    TextareaNotes)) as React.ComponentClass<IBaseProps>;
