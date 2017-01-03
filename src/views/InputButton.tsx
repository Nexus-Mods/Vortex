import { displayGroup } from '../actions/session';
import { IState } from '../types/IState';
import { ComponentEx, connect, translate } from '../util/ComponentEx';
import { getSafe } from '../util/storeHelper';

import Icon from './Icon';
import { Button } from './TooltipControls';

import * as React from 'react';
import update = require('react-addons-update');
import { FormControl } from 'react-bootstrap';

export interface IBaseProps {
  id: string;
  iconGroup?: string;
  icon: string;
  tooltip: string;
  onConfirmed: (input: string) => void;
  groupId: string;
}

interface IActionProps {
  onSelectDisplayGroup: (groupId: string, itemId: string) => void;
}

interface IConnectedProps {
  displayGroups: { [id: string]: string };
}

interface IComponentState {
  input: string;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class InputButton extends ComponentEx<IProps, IComponentState> {
  constructor(props) {
    super(props);

    this.state = {
      input: undefined,
    };
  }

  public render(): JSX.Element {
    return this.renderContent();
  }

  private renderContent() {
    const { t, displayGroups, groupId, icon, iconGroup, id, tooltip } = this.props;
    if (getSafe(displayGroups, [ groupId ], undefined) !== id) {
      return (
        <Button
          id={id}
          tooltip={t(tooltip)}
          onClick={this.startInput}
        >
          <Icon set={iconGroup} name={icon} />
        </Button>
      );
    } else {
      const { input } = this.state;
      return (
        <div className='inline-form'>
          <div style={{ flexGrow: 1 }}>
            <FormControl
              autoFocus
              type='text'
              value={input}
              onChange={this.updateInput}
              onKeyPress={this.handleKeypress}
            />
          </div>
          <Button
            id='accept-input'
            tooltip={t('Confirm')}
            onClick={this.confirmInput}
          >
            <Icon name='check' />
          </Button>
          <Button
            id='cancel-input'
            tooltip={t('Cancel')}
            onClick={this.closeInput}
          >
            <Icon name='remove' />
          </Button>
        </div>
      );
    }
  }

  private updateInput = (event) => {
    this.setState(update(this.state, {
      input: { $set: event.target.value },
    }));
  }

  private startInput = () => {
    const { groupId, id, onSelectDisplayGroup } = this.props;
    onSelectDisplayGroup(groupId, id);
  }

  private closeInput = () => {
    const { groupId, onSelectDisplayGroup } = this.props;
    this.setState(update(this.state, {
      input: { $set: '' },
    }));
    onSelectDisplayGroup(groupId, undefined);
  }

  private handleKeypress = (evt: React.KeyboardEvent<any>) => {
    if (evt.which === 13) {
      evt.preventDefault();
      this.confirmInput();
    }
  }

  private confirmInput = () => {
    this.props.onConfirmed(this.state.input);
    this.closeInput();
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    displayGroups: state.session.base.displayGroups,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSelectDisplayGroup:
      (groupId: string, itemId: string) => dispatch(displayGroup(groupId, itemId)),
  };
}

export default
  translate([ 'common' ], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(InputButton)
  ) as React.ComponentClass<IBaseProps>;
