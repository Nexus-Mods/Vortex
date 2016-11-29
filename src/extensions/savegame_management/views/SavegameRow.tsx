import { IComponentContext } from '../../../types/IComponentContext';

import { connect } from '../../../util/ComponentEx';

import { ISavegame } from '../types/ISavegame';
import { ISavegameAttribute } from '../types/ISavegameAttribute';

import * as React from 'react';

export interface IBaseProps {
  save: ISavegame;
  attributes: ISavegameAttribute[];
  language: string;
}

type IProps = IBaseProps;

class SavegameRow extends React.Component<IProps, {}> {
  public static contextTypes: React.ValidationMap<any> = {
    api: React.PropTypes.object.isRequired,
  };

  public context: IComponentContext;

  constructor(props) {
    super(props);
  }

  public render(): JSX.Element {
    const { attributes, save } = this.props;

    return (
      <tr
        id={save.id}
        key={save.id}
      >
        {attributes.map(this.renderAttribute)}
      </tr>
    );
  }

  private renderAttribute = (attribute: ISavegameAttribute): JSX.Element => {
    const { save } = this.props;
    return (
      <td key={ attribute.id }>
      {this.renderCell(attribute.calc(save.attributes))}
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

}

function mapStateToProps(state) {
  return {};
}

export default
  connect(mapStateToProps)(SavegameRow) as React.ComponentClass<IBaseProps>;
