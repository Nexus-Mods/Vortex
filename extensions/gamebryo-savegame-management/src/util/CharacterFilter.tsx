import { ISavegame } from '../types/ISavegame';

import * as React from 'react';
import { connect } from 'react-redux';
import * as Select from 'react-select';
import { types } from 'vortex-api';

interface IConnectedProps {
  savegames: { [saveId: string]: ISavegame };
}

type IProps = types.IFilterProps & IConnectedProps;

export class CharacterFilterComponent extends React.Component<IProps, {}> {
  public render(): JSX.Element {
    const { filter, savegames } = this.props;

    const characters = new Set(Object.keys(savegames).map(
      saveId => (savegames[saveId].attributes as any).name as string));

    const options = Array.from(characters).map(name => ({
      label: name,
      value: name,
    }));

    return (
      <Select
        className='select-compact'
        options={options}
        value={filter || ''}
        onChange={this.changeFilter}
      />
    );
  }

  private changeFilter = (value: { value: string, label: string }) => {
    const { attributeId, onSetFilter } = this.props;
    onSetFilter(attributeId, value !== null ? value.value : null);
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    savegames: state.session.saves.saves,
  };
}

const FilterConn = connect(mapStateToProps)(
  CharacterFilterComponent) as React.ComponentClass<types.IFilterProps>;

class CharacterFilter implements types.ITableFilter {
  public component = FilterConn;
  public raw = false;

  public matches(filter: any, value: any): boolean {
    return filter === value;
  }
}

export default CharacterFilter;
