import { IIconDefinition } from '../../../types/IIconDefinition';
import getAttr from '../../../util/getAttr';
import IconBar from '../../../views/IconBar';

import { connect } from '../../../util/ComponentEx';

import { IProfileMod } from '../../profile_management/types/IProfile';

import { removeMod } from '../actions/mods';
import { IMod } from '../types/IMod';
import { IModAttribute } from '../types/IModAttribute';

import * as fs from 'fs-extra-promise';
import * as React from 'react';
import { Checkbox } from 'react-bootstrap';

export interface IBaseProps {
  mod: IMod;
  modState: IProfileMod;
  attributes: IModAttribute[];
  language: string;
  onSetModEnabled: (modId: string, enabled: boolean) => void;
  onClick: __React.MouseEventHandler;
  selected: boolean;
}

interface IActionProps {
  onRemoveMod: (modId: string) => void;
}

type IProps = IBaseProps & IActionProps;

class ModRow extends React.Component<IProps, {}> {

  private modActions: IIconDefinition[];

  constructor(props) {
    super(props);

    this.modActions = [
      {
        icon: 'remove',
        title: 'Remove',
        action: this.remove,
      },
    ];
  }

  public render(): JSX.Element {
    const { attributes, mod, modState, onClick, selected } = this.props;

    let classes = ['mod-' + mod.state];
    if (selected) {
      classes.push('modlist-selected');
    }

    return (
      <tr
        id={mod.id}
        key={mod.id}
        className={classes.join(' ')}
        onClick={onClick}
      >
        <td>
          <Checkbox
            checked={getAttr(modState, 'enabled', false)}
            onChange={this.setModEnabled}
          />
        </td>
        {attributes.map(this.renderAttribute)}
        <td style={{ textAlign: 'center' }}>
          <IconBar
            group='mod-action-icons'
            instanceId={ mod.id }
            className='mod-actions'
            staticElements={ this.modActions }
          />
        </td>
      </tr>
    );
  }

  private remove = () => {
    const { mod, onRemoveMod } = this.props;
    if (mod.installationPath) {
      fs.removeAsync(mod.installationPath)
        .then(() => {
          onRemoveMod(mod.id);
        });
    } else {
      onRemoveMod(mod.id);
    }
  }

  private renderAttribute = (attribute: IModAttribute): JSX.Element => {
    const { mod } = this.props;
    return (
      <td key={ attribute.id }>
      {this.renderCell(attribute.calc(mod.attributes))}
      </td>
    );
  }

  private renderCell(value: any): string {
    const { language } = this.props;

    if (value instanceof Date) {
      return value.toLocaleString(language);
    } else if (typeof(value) === 'string') {
      return value;
    } else if ((value === undefined) || (value === null)) {
      return '';
    } else {
      return value.toString();
    }
  }

  private setModEnabled = (evt: React.MouseEvent) => {
    const { mod, onSetModEnabled } = this.props;
    onSetModEnabled(mod.id, (evt.target as HTMLInputElement).checked);
  }
}

function mapStateToProps(state) {
  return {};
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onRemoveMod: (modId: string) =>
      dispatch(removeMod(modId)),
  };
}

export default
  connect(mapStateToProps, mapDispatchToProps)(ModRow) as React.ComponentClass<IBaseProps>;
