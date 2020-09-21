import { IActionDefinition } from '../types/IActionDefinition';
import Icon from './Icon';
import { ButtonType } from './IconBar';

import { TFunction } from 'i18next';
import * as React from 'react';
import { Button, Dropdown, DropdownButton, MenuItem } from 'react-bootstrap';

function sharedStart(...input: string[]) {
  const inputArrs = input.map(iter => iter.split(' '));

  const diffIdx = inputArrs[0].findIndex((iter, idx) =>
    inputArrs.find(comp => comp[idx] !== iter) !== undefined);

  return inputArrs[0].slice(0, diffIdx).join(' ');
}

class ToolbarDropdownItem extends React.PureComponent<{ t?: TFunction, icon: IActionDefinition, instanceIds: string[] }, {}> {
  public render() {
    const { t, icon } = this.props;
    return (
      <MenuItem onSelect={this.invoke}>
        {t(icon.title)}
      </MenuItem>
    );
  }

  private invoke = () => {
    const { icon, instanceIds } = this.props;
    icon.action(instanceIds);
  }
}

export interface IToolbarDropdownProps {
  t: TFunction;
  id: string;
  instanceId: string[];
  icons: IActionDefinition[];
  className?: string;
  buttonType?: ButtonType;
  orientation: 'vertical' | 'horizontal';
}

class ToolbarDropdown extends React.PureComponent<IToolbarDropdownProps, {}> {
  public render(): JSX.Element {
    const { t, className, icons, id, instanceId } = this.props;
    let classes = ['toolbar-dropdown'];
    if (className !== undefined) {
      classes = classes.concat(className.split(' '));
    }

    const shared = sharedStart(...icons.map(icon => icon.title || ''));

    const def = icons.find(i => i.default);

    if (def !== undefined) {
      return (
        <Dropdown
          id={id}
          className={classes.join(' ')}
        >
          <Button onClick={this.invokeDefault} className='toolbar-dropdown-splitbtn'>
            {this.renderTitle(shared)}
          </Button>

          <Dropdown.Toggle />
          <Dropdown.Menu>
            {icons.map(icon => <ToolbarDropdownItem t={t} key={icon.title} icon={icon} instanceIds={instanceId} />)}
          </Dropdown.Menu>
        </Dropdown>
      );
    } else {
      return (
        <DropdownButton
          id={id}
          className={classes.join(' ')}
          title={this.renderTitle(shared)}
        >
          {icons.map(icon => <ToolbarDropdownItem t={t} key={icon.title} icon={icon} instanceIds={instanceId} />)}
        </DropdownButton>
      );
    }
  }

  private renderTitle(shared: string): JSX.Element {
    const { t, icons, buttonType } = this.props;
    const hasIcon = (buttonType === undefined)
      || ['icon', 'both', 'menu'].indexOf(buttonType) !== -1;
    const hasText = (buttonType === undefined)
      || ['text', 'both', 'menu'].indexOf(buttonType) !== -1;

    return (
      <div>
        {hasIcon ? <Icon name={icons[0].icon} /> : null}
        {hasText ? (<div className='button-text'>
          {t(shared)}...
        </div>) : null}
      </div>
    );
  }

  private invokeDefault = () => {
    const { icons, instanceId } = this.props;
    const def = icons.find(i => i.default);
    if (def !== undefined) {
      def.action(instanceId);
    }
  }
}

export default ToolbarDropdown;
