import { IState } from '../../../types/IState';
import { IFilterProps, ITableFilter } from '../../../types/ITableAttribute';
import { connect } from '../../../util/ComponentEx';
import { truthy } from '../../../util/util';

import { ICategoryDictionary } from '../../category_management/types/ICategoryDictionary';
import { activeGameId } from '../../profile_management/selectors';

import * as React from 'react';
import * as Select from 'react-select';

interface IConnectedProps {
  categories: ICategoryDictionary;
}

type IProps = IFilterProps & IConnectedProps;

class CategoryFilterComponent extends React.Component<IProps, {}> {
  public render(): JSX.Element {
    const { filter, categories } = this.props;

    const options = Object.keys(categories).map(id => ({
      value: id,
      label: categories[id].name,
    })).sort((lhs, rhs) => lhs.label.localeCompare(rhs.label));

    return <Select
      multi
      className='select-compact'
      options={options}
      value={filter}
      onChange={this.changeFilter}
    />;
  }

  private changeFilter = (value: { value: string, label: string }[]) => {
    const { attributeId, onSetFilter } = this.props;
    onSetFilter(attributeId, value.map(val => val.value));
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  const gameId = activeGameId(state);
  return {
    categories: state.persistent.categories[gameId],
  };
}

const CategoryFilterComponentConn = connect(mapStateToProps)(
  CategoryFilterComponent) as React.ComponentClass<IFilterProps>;

class CategoryFilter implements ITableFilter {
  public component = CategoryFilterComponentConn;
  public raw = true;

  public matches(filter: any, value: any, state: IState): boolean {
    const filtList = filter as string[];
    const allCategories = this.categoryChain(value, state);

    return (filtList.length === 0)
      || (filtList.find(filt => allCategories.has(filt)) !== undefined);
  }

  private categoryChain(category: string, state: IState): Set<string> {
    const gameId = activeGameId(state);
    const categories = state.persistent.categories[gameId];
    let result = new Set<string>();
    let iter = category;
    while (truthy(iter)) {
      result.add(iter);
      iter = categories[iter].parentCategory;
    }
    return result;
  }
}

export default CategoryFilter;
