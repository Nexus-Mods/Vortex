import { IActionDefinition } from '../types/IActionDefinition';
import { IExtensibleProps } from '../util/ExtensionProvider';

import ActionControl, { IActionControlProps, IActionDefinitionEx } from './ActionControl';
import DropdownButton from './DropdownButton';
import Icon from './Icon';

import * as _ from 'lodash';
import * as React from 'react';
import { MenuItem } from 'react-bootstrap';

export type ButtonType = 'text' | 'icon' | 'both' | 'menu';

export interface IBaseProps {
  className?: string;
  group?: string;
  instanceId?: string | string[];
  buttonType?: ButtonType;
  orientation?: 'horizontal' | 'vertical';
}

type IProps = IBaseProps & { actions?: IActionDefinitionEx[] } & React.HTMLAttributes<any>;

function genTooltip(show: boolean | string): string {
  return typeof (show) === 'string'
    ? show
    : undefined;
}

interface IMenuActionProps {
  id: string;
  action: IActionDefinitionEx;
  instanceId: string | string[];
  onSelect?: () => void;
}

class MenuAction extends React.PureComponent<IMenuActionProps, {}> {
  public render(): JSX.Element {
    const { action, id } = this.props;
    return (
      <MenuItem
        eventKey={id}
        onSelect={this.trigger}
        disabled={action.show !== true}
        title={genTooltip(action.show)}
      >
        <Icon name={action.icon} />
        <div className='button-text'>{action.title}</div>
      </MenuItem>
    );
  }

  private trigger = () => {
    const { action, instanceId, onSelect } = this.props;

    const instanceIds = typeof(instanceId) === 'string' ? [instanceId] : instanceId;

    action.action(instanceIds);
    onSelect();
  }
}

/**
 * represents an extensible row of icons/buttons/actions
 * In the simplest form this is simply a bunch of buttons that will run
 * an action if clicked, but an icon can also be more dynamic (i.e. rendering
 * dynamic content or having multiple states)
 *
 * @class IconBar
 * @extends {ComponentEx<IProps, {}>}
 */
class DropdownMenu extends React.PureComponent<IProps, {}> {
  public render(): JSX.Element {
    const { actions, id, className } = this.props;

    const classes: string[] = [];
    if (className) {
      classes.push(className);
    }

    const title: any = (
      <div
        title={genTooltip(actions[0].show)}
        style={{ width: '100%', height: '100%' }}
      >
        <Icon name={actions[0].icon} />
        {actions[0].title}
      </div>
    );
    return (
      <DropdownButton
        id={`${id}-menu`}
        split
        title={title}
        data-value={actions[0].title}
        onClick={actions[0].show ? this.triggerDefault : undefined}
      >
        {actions.slice(1).map((iter, idx) => this.renderMenuItem(iter, idx))}
      </DropdownButton>
    );
  }

  private renderMenuItem =
    (action: IActionDefinition & { show: boolean | string }, index: number) => {
    const { instanceId } = this.props;

    const id = `${instanceId || '1'}_${index}`;

    if ((action.icon === null) && (action.component === undefined)) {
      return (
        <MenuItem className='menu-separator-line' key={id} disabled={true}>
          {action.title}
        </MenuItem>
      );
    }

    if (action.icon !== undefined) {
      return <MenuAction key={id} id={id} action={action} instanceId={instanceId} />;
    } else {
      return (
        <MenuItem
          key={id}
          eventKey={id}
          disabled={action.show !== true}
          title={genTooltip(action.show)}
        >
          {this.renderCustomIcon(id, action)}
        </MenuItem>
      );
    }
  }

  private renderCustomIcon(id: string, action: IActionDefinition) {
    // custom case. the caller can pass properties via the props() function and by
    // passing the prop to the iconbar. the props on the iconbar that we don't handle are
    // passed on
    const knownProps = ['condition', 'className', 'group', 't', 'i18nLoadedAt',
      'objects', 'children'];
    const unknownProps = Object.keys(this.props).reduce((prev: any, current: string) => {
      if (knownProps.indexOf(current) === -1) {
        return {
          ...prev,
          [current]: this.props[current],
        };
      } else {
        return prev;
      }
    }, {});
    const staticProps = {
      ...unknownProps,
      key: id,
      buttonType: this.props.buttonType,
      orientation: this.props.orientation,
    };
    if (action.props !== undefined) {
      const addProps = action.props();
      return <action.component {...staticProps} {...addProps} />;
    } else {
      return <action.component {...staticProps} />;
    }
  }

  private triggerDefault = (evt: React.MouseEvent<any>) => {
    const { instanceId, actions } = this.props;
    const title = evt.currentTarget.attributes.getNamedItem('data-value').value;
    const action = actions.find(iter => iter.title === title);
    if (action !== undefined) {
      const instanceIds = typeof(instanceId) === 'string' ? [instanceId] : instanceId;
      action.action(instanceIds);
    }
  }
}

type ExportType = IBaseProps & IActionControlProps & IExtensibleProps & React.HTMLAttributes<any>;

class ActionDropdown extends React.Component<ExportType> {
  private static ACTION_PROPS = ['filter', 'group', 'instanceId', 'staticElements'];
  public render() {
    const actionProps: IActionControlProps =
      _.pick(this.props, ActionDropdown.ACTION_PROPS) as IActionControlProps;
    const menuProps: IBaseProps =
      _.omit(this.props, ActionDropdown.ACTION_PROPS) as any;
    return (
      <ActionControl {...actionProps}>
        <DropdownMenu {...menuProps} />
      </ActionControl>
    );
  }
}

export default ActionDropdown as React.ComponentClass<ExportType>;
