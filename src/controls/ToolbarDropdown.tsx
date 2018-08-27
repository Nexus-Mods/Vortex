import Icon from './Icon';

import * as React from 'react';
import { IActionDefinition } from '../types/api';
import { DropdownButton, MenuItem } from 'react-bootstrap';

function sharedStart(...input: string[]) {
  const inputArrs = input.map(iter => iter.split(' '));

  const diffIdx = inputArrs[0].findIndex((iter, idx) =>
    inputArrs.find(comp => comp[idx] !== iter) !== undefined);

  return inputArrs[0].slice(0, diffIdx).join(' ');
}

class ToolbarDropdownItem extends React.PureComponent<{ icon: IActionDefinition, instanceIds: string[] }, {}> {
  public render() {
    const { icon } = this.props;
    return (
      <MenuItem onSelect={this.invoke}>
        {icon.title}
      </MenuItem>
    );
  }

  private invoke = () => {
    const { icon, instanceIds } = this.props;
    icon.action(instanceIds);
  }
}


export interface IToolbarDropdownProps {
  id: string;
  instanceId: string[];
  icons: IActionDefinition[];
  className?: string;
}

class ToolbarDropdown extends React.PureComponent<IToolbarDropdownProps, {}> {
  public render(): JSX.Element {
    const { className, icons, id, instanceId } = this.props;
    let classes = ['toolbar-dropdown'];
    if (className !== undefined) {
      classes = classes.concat(className.split(' '));
    }

    const shared = sharedStart(...icons.map(icon => icon.title));

    return (
      <DropdownButton
        id={id}
        className={classes.join(' ')}
        title={this.renderTitle(shared)}
      >
        {icons.map(icon => <ToolbarDropdownItem key={icon.title} icon={icon} instanceIds={instanceId} />)}
      </DropdownButton>
    );
  }

  private renderTitle(shared: string): JSX.Element {
    const { icons } = this.props;
    return (
      <div>
        <Icon name={icons[0].icon} />
        <div className='button-text'>
          {shared}...
        </div>
      </div>
    );
  }
}

export default ToolbarDropdown;
