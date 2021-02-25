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
import update from 'immutability-helper';
import * as _ from 'lodash';
import * as React from 'react';
import { Creatable } from 'react-select';

interface IConnectedProps {
  gameId: string;
  categories: ICategoryDictionary;
  mods: { [modId: string]: IMod };
  downloads: { [archiveId: string]: IDownload };
}

type IProps = IFilterProps & IConnectedProps;

interface IComponentState {
  archiveCategories: { [archiveId: string]: string };
  customOption: { label: string, value: string };
}

// react-select doesn't deal well with undefined/null as values, it converts all values to string
// internally and Vortex allows practically every string as category ids. That combined means we
// can't 100% avoid collisions with user-categories - but I think it's rather safe that the user
// doesn't use this accidentally...
const UNASSIGNED_ID = 'ea199e24-1b06-11e9-ab14-d663bd873d93';

class CategoryFilterComponent extends React.Component<IProps, IComponentState> {
  private mCustomOptionTemp: { label: string, value: string } = undefined;

  constructor(props: IProps) {
    super(props);
    this.state = {
      archiveCategories: {},
      customOption: undefined,
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
    const { t, filter, categories, mods } = this.props;
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
    options.unshift({ value: UNASSIGNED_ID, label: `<${t('Unassigned')}>` });
    if (this.state.customOption !== undefined) {
      options.unshift(this.state.customOption);
    }

    // Select.Creatable is just completely broken, there is no other way to say.
    // it pushes the created option into the options object - ignoring the immutable
    // principle of react without even documenting that and then createNewOption gets called
    // constantly during filtering which makes this the wrong place to - you know -
    // actually create the new option.
    // Oh, and it calls createNewOption twice, once with the actual input, once with the
    // "Create New Option" text as part of the label - like a total f*ing ***
    // How is this supposed to be used in practice without hacking?

    return (
      <Creatable
        multi
        className='select-compact'
        options={options}
        value={filter}
        onChange={this.changeFilter}
        autosize={false}
        showNewOptionAtTop={true}
        promptTextCreator={this.promptCreate}
        shouldKeyDownEventCreateNewOption={this.shouldCreate}
        newOptionCreator={this.createNewOption}
      />
    );
  }

  private promptCreate = (filter: string) => {
    // Praise be the mighty hack. Prepending a "zero-width-space" to allow
    // createNewOption detect the prompt
    return '\u200B' + this.props.t('Search: ') + filter;
  }

  private shouldCreate = ({ keyCode }) => {
    const should = [9, 13].includes(keyCode);
    if (should) {
      this.setState(update(this.state, { customOption: { $set: this.mCustomOptionTemp } }));
    }
    return should;
  }

  private createNewOption = ({ label, labelKey, valueKey }) => {
    if (label.startsWith('\u200B')) {
      // don't save the prompt to state
      return { value: '*' + label, label };
    }

    this.mCustomOptionTemp = {
      value: '*' + label,
      label,
    };
    return this.mCustomOptionTemp;
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

    let customOption;
    const customFilter = (props.filter ?? []).find(filt => filt.startsWith('*'));
    if (customFilter !== undefined) {
      customOption = { label: customFilter.slice(1), value: customFilter };
    }

    Promise.map(filtered, archiveId =>
      filterModInfo({ download: props.downloads[archiveId] }, undefined)
        .then(info => {
          if (info.category !== undefined) {
            archiveCategories[archiveId] = info.category;
          }
        }))
      .then(() => {
        this.setState({ archiveCategories, customOption });
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

  public matches(filter: string[], value: any, state: IState): boolean {
    if (filter.length === 0) {
      // no filter category set
      return true;
    }

    const filtList = new Set<string>(filter.filter(f => !f.startsWith('*')));
    const allCategories = (value !== undefined)
      ? this.categoryChain(value.toString(), state)
      : [UNASSIGNED_ID];

    if (allCategories.find(cat => filtList.has(cat)) !== undefined) {
      return true;
    }

    // this supports multiple patterns but the UI does not
    const patterns = filter.filter(f => f.startsWith('*')).map(f => f.slice(1).toLowerCase());
    if ((patterns.length > 0) && (value !== undefined)) {
      const gameId = activeGameId(state);
      const catName = state.persistent.categories[gameId]?.[value];
      if ((catName !== undefined)
          && (patterns.find(pat => catName.name.toLowerCase().includes(pat)) !== undefined)) {
        return true;
      }
    }

    return false;
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
