import Promise from 'bluebird';
import * as _ from 'lodash';
import * as React from 'react';
import Select from 'react-select';
import { connect } from 'react-redux';
import { types, selectors } from 'vortex-api';
import { ILOOTList } from '../types/ILOOTList';

interface IConnectedProps {
  gameId: string;
  userlist: ILOOTList;
  masterlist: ILOOTList;
}

type IProps = types.IFilterProps & IConnectedProps;

class GroupFilterComponent extends React.Component<IProps, {}> {
  public render(): JSX.Element {
    const { filter, masterlist, userlist } = this.props;

    const options = Array.from(new Set(
          [].concat(masterlist.groups || [], userlist.groups || [])
            .map(iter => iter.name)))
      .map(iter => ({ label: iter, value: iter }));

    // react-select is marked as an external module in our webpack config.
    //  This means that even though we're trying to use version 5, the actual
    //  version that gets used is 1.3.0, which has a different API.
    //  The proper fix for this is to update react-select to version 5 in the package
    //  file, but that will break any other extensions that use react-select, so for
    //  now we just have to be hacky.
    // TODO: Update react-select to version 5 and remove the cast to any.
    const SelectV1 = Select as any;
    return (
      <SelectV1
        multi
        className='select-compact'
        options={options}
        value={Array.isArray(filter) ? filter : []}
        onChange={this.changeFilter}
      />
    );
  }

  private changeFilter = (value: Array<{ value: string, label: string }>) => {
    const { attributeId, onSetFilter } = this.props;
    onSetFilter(
      attributeId,
      (Array.isArray(value) ? value : []).map((val) => val.value),
    );
  };
}

const emptyList: ILOOTList = {
  globals: [],
  groups: [],
  plugins: [],
};

function mapStateToProps(state: any): IConnectedProps {
  const gameId = selectors.activeGameId(state);
  return {
    gameId,
    userlist: state.userlist || emptyList,
    masterlist: state.masterlist || emptyList,
  };
}

const GroupFilterComponentConn = connect(mapStateToProps)(
  GroupFilterComponent) as any;

class GroupFilter implements types.ITableFilter {
  public component = GroupFilterComponentConn;
  public raw = false;

  public matches(filter: any, value: any, state: types.IState): boolean {
    if (!Array.isArray(filter) || filter.length === 0) {
      // no filter category set
      return true;
    }

    return filter.indexOf(value) !== -1;
  }

  public isEmpty(filter: any): boolean {
    return !Array.isArray(filter) || filter.length === 0;
  }
}

export default GroupFilter;
