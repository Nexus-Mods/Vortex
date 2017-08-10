import * as React from 'react';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';
import { actions, ComponentEx, Icon, selectors, tooltip, types, util } from 'vortex-api';

export interface IBaseProps {
  mods: types.IMod[];
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
      valueCache: this.getValue(props),
    });

    this.mDebouncer = new util.Debouncer((newNote: string) => {
      const { gameMode, mods, onSetModAttribute } = this.props;
      mods.forEach(mod => {
        this.props.onSetModAttribute(gameMode, mod.id, 'notes', newNote);
      });
      return null;
    }, 500);
  }

  public componentWillReceiveProps(newProps: IProps) {
    const newValue = this.getValue(newProps);
    if (newValue !== this.state.valueCache) {
      this.nextState.valueCache = newValue;
    }
  }

  public shouldComponentUpdate(nextProps: IProps, nextState: IComponentState) {
    return this.props.mods !== nextProps.mods
        || this.props.gameMode !== nextProps.gameMode
        || this.state !== nextState;
  }

  public render(): JSX.Element {
    const { t, mods } = this.props;
    const { valueCache } = this.state;

    return (
      <textarea
        value={valueCache !== null ? valueCache : ''}
        id={mods[0].id}
        className='textarea-notes'
        onChange={this.handleChange}
        placeholder={valueCache !== null
          ? t('Write your own notes on this mod')
          : t('Multiple values')}
      />
    );
  }

  private getValue(props: IProps) {
    const value = util.getSafe(props.mods[0].attributes, ['notes'], '');
    const different = props.mods.find(iter =>
        util.getSafe(iter.attributes, ['notes'], '') !== value) !== undefined;

    return different ? null : value;
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
