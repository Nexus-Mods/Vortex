import { IDownload, IState } from '../../../types/IState';
import { IFilterProps, ITableFilter } from '../../../types/ITableAttribute';
import { connect } from '../../../util/ComponentEx';
import { getSafe } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';

import { ICategoryDictionary } from '../../category_management/types/ICategoryDictionary';
import getDownloadGames from '../../download_management/util/getDownloadGames';
import { IMod } from '../../mod_management/types/IMod';
import filterModInfo from '../../mod_management/util/filterModInfo';
import { activeGameId } from '../../profile_management/selectors';

import Promise from 'bluebird';
import * as _ from 'lodash';
import * as React from 'react';
import Select from 'react-select';

interface IConnectedProps {
  gameId: string;
  categories: ICategoryDictionary;
  mods: { [modId: string]: IMod };
  downloads: { [archiveId: string]: IDownload };
}

type IProps = IFilterProps & IConnectedProps;

interface IComponentState {
  archiveCategories: { [archiveId: string]: string };
}

// react-select doesn't deal well with undefined/null as values, it converts all values to string
// internally and Vortex allows practically every string as category ids. That combined means we
// can't 100% avoid collisions with user-categories - but I think it's rather safe that the user
// doesn't use this accidentally...
const UNASSIGNED_ID = 'ea199e24-1b06-11e9-ab14-d663bd873d93';

class CategoryFilterComponent extends React.Component<IProps, IComponentState> {
  constructor(props: IProps) {
    super(props);
    this.state = {
      archiveCategories: {},
    };
  }

  public componentDidMount() {
    this.updateState([], this.props, true);
  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
    if (this.props.downloads !== newProps.downloads) {

      const before = Object.keys(this.props.downloads)
        .filter(dlId =>
          getDownloadGames(this.props.downloads[dlId]).indexOf(this.props.gameId) !== -1);

      this.updateState(before, newProps, false);
    }
  }

  public render(): JSX.Element {
    const { filter, categories, mods } = this.props;
    const { archiveCategories } = this.state;

    const installedArchives = new Set<string>();
    const modCategories = new Set<string>();
    Object.keys(mods || {}).forEach(modId => {
      const mod = mods[modId];
      let category = getSafe(mod.attributes, ['category'], undefined);
      while (category !== undefined) {
        if (categories[category] !== undefined) {
          modCategories.add(category.toString());
          category = categories[category].parentCategory;
        } else {
          category = undefined;
        }
      }
      if (mod.archiveId !== undefined) {
        installedArchives.add(mod.archiveId);
      }
    });

    Object.keys(archiveCategories).forEach(archiveId => {
      if (!installedArchives.has(archiveId)) {
        modCategories.add(archiveCategories[archiveId].toString());
      }
    });

    const options = Array.from(modCategories)
      .filter(id => getSafe(categories, [id], undefined) !== undefined)
      .map(id => ({
        value: id.toString(),
        label: getSafe(categories, [id, 'name'], ''),
      })).sort((lhs, rhs) => lhs.label.localeCompare(rhs.label));
    options.unshift({ value: UNASSIGNED_ID, label: '<Unassigned>' });

    return (
      <Select
        multi
        className='select-compact'
        options={options}
        value={filter}
        onChange={this.changeFilter}
        autosize={false}
      />
    );
  }

  private updateState(before: string[], props: IProps, force: boolean) {
    const archiveCategories = { ...this.state.archiveCategories };
    const after = Object.keys(props.downloads)
      .filter(dlId => getDownloadGames(props.downloads[dlId]).indexOf(props.gameId) !== -1);
    const removed: string[] = _.difference(before, after);
    // remove disappeared downloads
    removed.forEach(archiveId => { delete archiveCategories[archiveId]; });
    // update added or changed downloads
    const filtered = force ? after : after.filter(
      archiveId => this.props.downloads[archiveId] !== props.downloads[archiveId]);

    Promise.map(filtered, archiveId =>
      filterModInfo({ download: props.downloads[archiveId] }, undefined)
        .then(info => {
          if (info.category !== undefined) {
            archiveCategories[archiveId] = info.category;
          }
        }))
      .then(() => {
        this.setState({ archiveCategories });
      });
  }

  private changeFilter = (value: Array<{ value: string, label: string }>) => {
    const { attributeId, onSetFilter } = this.props;
    onSetFilter(attributeId, value.map(val => val.value));
  }
}

const emptyDict = {};

function mapStateToProps(state: IState): IConnectedProps {
  const gameId = activeGameId(state);
  return {
    gameId,
    categories: state.persistent.categories[gameId] || emptyDict,
    mods: state.persistent.mods[gameId],
    downloads: state.persistent.downloads.files || emptyDict,
  };
}

const CategoryFilterComponentConn = connect(mapStateToProps)(
  CategoryFilterComponent) as unknown as React.ComponentClass<IFilterProps>;

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
      : [UNASSIGNED_ID];

    return allCategories.find(cat => filtList.has(cat)) !== undefined;
  }

  public isEmpty(filter: any): boolean {
    return filter.length === 0;
  }

  private categoryChain(category: string, state: IState): string[] {
    const gameId = activeGameId(state);
    const categories = state.persistent.categories[gameId] || {};
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
