import * as React from 'react';

import { IMod } from '../types/IMod';
import { IModAttribute } from '../types/IModAttribute';

interface IProps {
  mod: IMod;
  attributes: IModAttribute[];
}

class ModRow extends React.Component<IProps, {}> {
  public render(): JSX.Element {
    const { attributes, mod } = this.props;

    return <tr key={mod.id} className={'mod-' + mod.state}>
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
}

export default ModRow;
