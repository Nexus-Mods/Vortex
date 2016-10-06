import { IProfileMod } from '../../profile_management/types/IProfile';

import { IMod } from '../types/IMod';
import { IModAttribute } from '../types/IModAttribute';
import getAttr from '../util/getAttr';

import * as React from 'react';
import { Checkbox } from 'react-bootstrap';

interface IProps {
  mod: IMod;
  modState: IProfileMod;
  attributes: IModAttribute[];
  onSetModEnabled: (modId: string, enabled: boolean) => void;
}

class ModRow extends React.Component<IProps, {}> {
  public render(): JSX.Element {
    const { attributes, mod, modState } = this.props;

    return <tr key={mod.id} className={'mod-' + mod.state}>
      <td>
      <Checkbox
        checked={ getAttr(modState, 'enabled', false) }
        onChange={ this.setModEnabled }
      />
      </td>
      { attributes.map(this.renderAttribute) }
    </tr>;
  }

  private renderAttribute = (attribute: IModAttribute): JSX.Element => {
    const { mod } = this.props;
    return <td key={ attribute.id }>{this.renderCell(mod.attributes[attribute.id])}</td>;
  }

  private renderCell(value: any): string {
    const valType = typeof(value);
    if (valType === 'Date') {
      return value.toLocaleString();
    } else if (valType === 'string') {
      return value;
    } else {
      return value.toString();
    }
  }

  private setModEnabled = (evt: React.MouseEvent) => {
    const { mod, onSetModEnabled } = this.props;
    onSetModEnabled(mod.id, (evt.target as HTMLInputElement).checked);
  }
}

export default ModRow;
