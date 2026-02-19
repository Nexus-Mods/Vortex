import { ISavegame } from "../types/ISavegame";

import * as React from "react";
import { connect } from "react-redux";
import Select from "react-select";
import { types } from "vortex-api";

type SGListCB = () => { [saveId: string]: ISavegame };

interface IExtraProps {
  getSGList: SGListCB;
}

interface IConnectedProps {
  savegames: { [saveId: string]: ISavegame };
}

type IProps = types.IFilterProps & IExtraProps & IConnectedProps;

export class CharacterFilterComponent extends React.Component<IProps, {}> {
  public render(): JSX.Element {
    const { filter, getSGList } = this.props;

    const savegames = getSGList();

    const characters = new Set(
      Object.keys(savegames).map(
        (saveId) => (savegames[saveId].attributes as any).name as string,
      ),
    );

    const options = Array.from(characters).map((name) => ({
      label: name,
      value: name,
    }));

    return (
      <Select
        className="select-compact"
        options={options}
        value={filter || ""}
        onChange={this.changeFilter}
      />
    );
  }

  private changeFilter = (value: { value: string; label: string }) => {
    const { attributeId, onSetFilter } = this.props;
    onSetFilter(attributeId, value !== null ? value.value : null);
  };
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    savegames: state.session.saves.saves,
  };
}

const FilterConn = connect(mapStateToProps)(
  CharacterFilterComponent,
) as unknown as React.ComponentClass<types.IFilterProps & IExtraProps>;

class CharacterFilter implements types.ITableFilter {
  public component: React.ComponentType<types.IFilterProps & IExtraProps>;
  public raw = false;
  private mGetSGList: SGListCB;

  constructor(getSGList: SGListCB) {
    this.mGetSGList = getSGList;
    this.component = (props: types.IFilterProps) => (
      <FilterConn {...props} getSGList={this.mGetSGList} />
    );
  }

  public matches(filter: any, value: any): boolean {
    return filter === value;
  }
}

export default CharacterFilter;
