import { IState } from '../../../types/IState';
import { IFilterProps, ITableFilter } from '../../../types/ITableAttribute';
import { connect } from '../../../util/ComponentEx';
import { getSafe } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';

import { ICategoryDictionary } from '../../category_management/types/ICategoryDictionary';
import { IMod } from '../../mod_management/types/IMod';
import { activeGameId } from '../../profile_management/selectors';

import * as React from 'react';
import Select from 'react-select';

interface IConnectedProps {
  categories: ICategoryDictionary;
  mods: { [modId: string]: IMod };
}

type IProps = IFilterProps & IConnectedProps;

class CategoryFilterComponent extends React.Component<IProps, {}> {
  public render(): JSX.Element {
    const { filter, categories, mods } = this.props;

    const usedCategories = new Set(
        Object.keys(mods || {})
          .map(modId => mods[modId].attributes['category'])
          .filter(category => category !== undefined));

    const options = Array.from(usedCategories)
      .filter(id => categories[id] !== undefined)
      .map(id => ({
        value: id.toString(),
        label: getSafe(categories, [id, 'name'], undefined),
      })).sort((lhs, rhs) => lhs.label.localeCompare(rhs.label));

    return (
      <Select
        multi
        className='select-compact'
        options={options}
        value={filter}
        onChange={this.changeFilter}
      />
    );
  }

  private changeFilter = (value: Array<{ value: string, label: string }>) => {
    const { attributeId, onSetFilter } = this.props;
    onSetFilter(attributeId, value.map(val => val.value));
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  const gameId = activeGameId(state);
  return {
    categories: state.persistent.categories[gameId],
    mods: state.persistent.mods[gameId],
  };
}

const CategoryFilterComponentConn = connect(mapStateToProps)(
  CategoryFilterComponent) as React.ComponentClass<IFilterProps>;

class CategoryFilter implements ITableFilter {
  public component = CategoryFilterComponentConn;
  public raw = 'attributes';

  public matches(filter: any, value: any, state: IState): boolean {
    if (filter.length === 0) {
      // no filter category set
      return true;
    }

    const filtList = new Set<string>(filter);
    const allCategories = (value !== undefined)
      ? this.categoryChain(value.toString(), state)
      : [];

    return allCategories.find(cat => filtList.has(cat)) !== undefined;
  }

  private categoryChain(category: string, state: IState): string[] {
    const gameId = activeGameId(state);
    const categories = state.persistent.categories[gameId];
    const result: string[] = [];
    let iter = category;
    while (truthy(iter) && (categories[iter] !== undefined)) {
      result.push(iter);
      iter = categories[iter].parentCategory;
    }
    return result;
  }
}

export default CategoryFilter;
