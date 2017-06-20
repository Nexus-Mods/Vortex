import { showDialog } from '../../../actions/notifications';
import { IActionDefinition } from '../../../types/IActionDefinition';
import { IComponentContext } from '../../../types/IComponentContext';
import { DialogType, IDialogActions, IDialogContent, IDialogResult } from '../../../types/IDialog';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import lazyRequire from '../../../util/lazyRequire';
import { showError } from '../../../util/message';
import { activeGameId } from '../../../util/selectors';
import Icon from '../../../views/Icon';
import IconBar from '../../../views/IconBar';
import { Button, IconButton } from '../../../views/TooltipControls';

import { IMod } from '../../mod_management/types/IMod';

import { removeCategory, renameCategory, setCategory } from '../actions/category';
import { ICategory } from '../types/ICategoryDictionary';
import { ICategoriesTree } from '../types/ITrees';
import createTreeDataObject from '../util/createTreeDataObject';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as path from 'path';
import * as React from 'react';
import { FormControl } from 'react-bootstrap';
import * as SortableTreeT from 'react-sortable-tree';

const tree = lazyRequire<typeof SortableTreeT>('react-sortable-tree');

const nop = () => undefined;

interface ISearchMatch {
  node: ICategoriesTree;
  path: string[];
  treeIndex: number;
}

interface IActionProps {
  onShowError: (message: string, details: string | Error) => void;
  onSetCategory: (gameId: string, categoryId: string, category: ICategory) => void;
  onRemoveCategory: (gameId: string, categoryId: string) => void;
  onRenameCategory: (activeGameId: string, categoryId: string, newCategory: {}) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                 actions: IDialogActions) => Promise<IDialogResult>;
}

interface IConnectedProps {
  gameMode: string;
  language: string;
  categories: ICategory[];
  mods: { [ modId: string ]: IMod };
}

interface IComponentState {
  treeData: ICategoriesTree[];
  expanded: string[];
  showEmpty: boolean;
  searchString: string;
  searchFocusIndex: number;
  searchFoundCount: number;
}

type IProps = IConnectedProps & IActionProps;

/**
 * displays the list of categories related for the current game.
 *
 */
class CategoryList extends ComponentEx<IProps, IComponentState> {
  public context: IComponentContext;
  private mButtons: IActionDefinition[];

  constructor(props) {
    super(props);
    this.initState({
      treeData: [],
      expanded: [],
      showEmpty: true,
      searchString: '',
      searchFocusIndex: 0,
      searchFoundCount: 0,
    });

    const { t } = props;

    this.mButtons = [
      {
        title: t('Expand All'),
        icon: 'expand',
        action: this.expandAll,
      }, {
        title: t('Collapse All'),
        icon: 'compress',
        action: this.collapseAll,
      }, {
        title: t('Add Root Category'),
        icon: 'folder-add',
        action: this.addRootCategory,
      }, {
        title: t('Show/Hide empty categories'),
        icon: 'eye-slash',
        action: this.toggleShowEmpty,
      },
    ];
  }

  public componentWillMount() {
    this.refreshTree(this.props);
  }

  public componentWillReceiveProps(newProps: IProps) {
    if (this.props.categories !== newProps.categories) {
      this.refreshTree(newProps);
    }
  }

  public render(): JSX.Element {
    const { t } = this.props;
    const { expanded, searchString, searchFocusIndex,
            searchFoundCount, showEmpty, treeData } = this.state;

    const expandedTreeData =
      this.applyExpand(treeData, showEmpty, new Set(expanded));

    const Tree = tree.SortableTreeWithoutDndContext;
    if (treeData !== undefined) {
      return (
        <div style={{ height: 500 }}>
          <IconBar
            group='categories-icons'
            staticElements={this.mButtons}
          />
          <div className='search-category-box'>
            <div style={{ display: 'inline-block' }}>
              <FormControl
                id='search-category-input'
                type='text'
                placeholder={t('Search')}
                value={searchString || ''}
                onChange={this.startSearch}
              />
              <span className='search-position' >
                {
                  t('{{ pos }} of {{ total }}', {
                    replace: {
                      pos: searchFoundCount > 0 ? (searchFocusIndex + 1) : 0,
                      total: searchFoundCount || 0,
                    },
                  })
                }
              </span>
            </div>
            <IconButton
              id='btn-search-category-prev'
              className='btn-embed'
              icon='angle-up'
              tooltip={t('Prev')}
              type='button'
              disabled={!searchFoundCount}
              onClick={this.selectPrevMatch}
            />
            <IconButton
              id='btn-search-category-next'
              className='btn-embed'
              icon='angle-down'
              tooltip={t('Next')}
              type='button'
              disabled={!searchFoundCount}
              onClick={this.selectNextMatch}
            />
            </div>
          <Tree
            treeData={expandedTreeData}
            onChange={nop}
            onVisibilityToggle={this.toggleVisibility}
            onMoveNode={this.moveNode}
            style={{ height: '95%' }}
            autoHeight={false}
            searchQuery={searchString}
            searchFocusOffset={searchFocusIndex}
            searchFinishCallback={this.searchFinishCallback}
            getNodeKey={this.getNodeKey}
            generateNodeProps={this.generateNodeProps}
          />
        </div>
      );
    } else {
      return (
        <div style={{ height: '90%' }}>
          <Button
            id='add-category'
            tooltip={t('Add Root Category')}
            onClick={this.addRootCategory}
          >
            <Icon name='folder-add' />
          </Button>
          <IconBar
            group='categories-icons'
            staticElements={null}
          />
        </div>
      );
    }
  }

  private getNonEmptyCategories(treeData: ICategoriesTree[], ancestry: string[]): string[] {
    let res: string[] = [];
    treeData.forEach(category => {
      if (category.modCount > 0) {
        res.push(category.categoryId);
        res = res.concat(ancestry);
      }
      res = res.concat(this.getNonEmptyCategories(category.children,
                                                  [].concat(ancestry, [category.categoryId])));
    });
    return res;
  }

  private applyExpand(treeData: ICategoriesTree[], showEmpty: boolean,
                      expanded: Set<string>): ICategoriesTree[] {
    let filtered: Set<string>;
    if (showEmpty) {
      const { categories, gameMode } = this.props;
      filtered = new Set(Object.keys(categories[gameMode]));
    } else {
      filtered = new Set(this.getNonEmptyCategories(treeData, []));
    }

    return treeData.map(obj => {
      if (!filtered.has(obj.categoryId)) {
        return undefined;
      }
      const copy: ICategoriesTree = { ...obj };
      copy.expanded = expanded.has(copy.categoryId);
      copy.children = this.applyExpand(copy.children, showEmpty, expanded);
      return copy;
    })
    .filter(obj => obj !== undefined)
    ;
  }

  private toggleShowEmpty = () => {
    const {t, categories, gameMode, mods, onShowError} = this.props;
    const { showEmpty } = this.state;

    try {
      const newTree = createTreeDataObject(t, categories[gameMode], mods);
      this.nextState.treeData = newTree;
      this.nextState.showEmpty = !showEmpty;
    } catch (err) {
      onShowError('An error occurred hiding/showing the empty categories', err);
    }
  }

  private expandAll = () => {
    const { categories, gameMode } = this.props;
    this.nextState.expanded = Object.keys(categories[gameMode]);
  }

  private collapseAll = () => {
    this.nextState.expanded = [];
  }

  private renameCategory = (info: { node: ICategoriesTree, path: string[] }) => {
    const {gameMode, onShowDialog, onRenameCategory} = this.props;
    onShowDialog('info', 'Rename Category', {
      input: [{ id: 'newCategory', value: info.node.title, label: 'Category' }],
    }, {
        Cancel: null,
        Rename: null,
      }).then((result: IDialogResult) => {
        if ((result.action === 'Rename') && (result.input.newCategory !== undefined)) {
          onRenameCategory(gameMode, info.node.categoryId, result.input.newCategory);
        }
      });
  }

  private addCategory = (info: { node: ICategoriesTree, path: string[] }) => {
    const {categories, gameMode, onSetCategory, onShowDialog, onShowError} = this.props;
    const lastIndex = this.searchLastRootId(categories);

    onShowDialog('question', 'Add Child Category', {
      input: [
        { id: 'newCategory', value: '', label: 'Category Name' },
        {
          id: 'newCategoryId', value: lastIndex.toString(),
          label: 'Category ID',
        },
      ],
    }, {
        Cancel: null,
        Add: null,
      }).then((result: IDialogResult) => {
        if (result.action === 'Add') {
          const checkId = Object.keys(categories[gameMode]).filter((id: string) =>
            id === result.input.newCategoryId);
          if (checkId.length !== 0) {
            onShowError('An error occurred adding the new category', 'ID already used.');
          } else if (result.input.newCategoryId === '') {
            onShowError('An error occurred adding the new category', 'Category ID empty.');
          } else {
            onSetCategory(gameMode, result.input.newCategoryId, {
              name: result.input.newCategory,
              parentCategory: info.node.categoryId,
              order: 0,
            });
          }
        }
      });
  }

  private addRootCategory = () => {
    const {categories, gameMode, onSetCategory, onShowDialog, onShowError} = this.props;
    let addCategory = true;
    const lastIndex = this.searchLastRootId(categories);

    onShowDialog('question', 'Add new Root Category', {
      input: [
        { id: 'newCategory', value: '', label: 'Category Name' },
        {
          id: 'newCategoryId', value: lastIndex.toString(),
          label: 'Category ID',
        },
      ],
    }, {
        Cancel: null,
        Add: null,
      }).then((result: IDialogResult) => {
        addCategory = result.action === 'Add';
        if (addCategory) {
          const checkId = Object.keys(categories[gameMode]).filter((id: string) =>
            id === result.input.newCategoryId);
          if (checkId.length !== 0) {
            onShowError('An error occurred adding the new category', 'ID already used.');
          } else if (result.input.newCategoryId === '') {
            onShowError('An error occurred adding the new category', 'Category ID empty.');
          } else {
            onSetCategory(gameMode, result.input.newCategoryId, {
              name: result.input.newCategory,
              parentCategory: undefined,
              order: 0,
            });
          }
        }
      });
  }

  private searchLastRootId(categories: any) {
    const {gameMode} = this.props;
    let maxId = 0;
    if (categories[gameMode] !== undefined) {
    Object.keys(categories[gameMode]).filter((id: string) => {
      if (parseInt(id, 10) > maxId) {
        maxId = parseInt(id, 10);
      }
    });
    }
    return maxId + 1;
  }

  private selectPrevMatch = () => {
    const { searchFocusIndex, searchFoundCount } = this.state;

    this.nextState.searchFocusIndex = (searchFoundCount + searchFocusIndex - 1) % searchFoundCount;
  }

  private selectNextMatch = () => {
    const { searchFocusIndex, searchFoundCount } = this.state;

    this.nextState.searchFocusIndex = (searchFocusIndex + 1) % searchFoundCount;
  }

  private refreshTree(props: IProps) {
    const { t } = this.props;
    const { categories, gameMode, mods, onShowError } = props;

    if (categories[gameMode] !== undefined) {
      if (categories[gameMode].length !== 0) {
        this.nextState.treeData =
          createTreeDataObject(t, categories[gameMode], mods);
      } else {
        const globalPersistentPath = path.join(remote.app.getPath('userData'), 'state');
        onShowError('An error occurred loading the categories.',
          'Can\'t read local categories. If you manually edited global_persistent you probably ' +
          'damaged the file. If you did\'t, please report a bug and include the ' +
          'global_persistent file. You can find it here:' + globalPersistentPath);
      }
    }
  }

  private startSearch = (event) => {
    this.nextState.searchString = event.target.value;
  }

  private searchFinishCallback = (matches: ISearchMatch[]) => {
    const { searchFocusIndex } = this.state;
    // important: Avoid updating the state if the values haven't changed because
    //  changeing the state causes a re-render and a re-render causes the tree to search
    //  again (why?) which causes a new finish callback -> infinite loop
    if (this.state.searchFoundCount !== matches.length) {
      this.nextState.searchFoundCount = matches.length;
    }
    const newFocusIndex = matches.length > 0 ? searchFocusIndex % matches.length : 0;
    if (this.state.searchFocusIndex !== newFocusIndex) {
    this.nextState.searchFocusIndex = newFocusIndex;
    }
  }

  private removeCategory = (categoryId: string) => {
    const {gameMode, onRemoveCategory} = this.props;
    onRemoveCategory(gameMode, categoryId);
  }

  private generateNodeProps = (rowInfo) => {
    const {t} = this.props;
    return {
      buttons: [
        (
          <Button
            id='rename-category'
            className='btn-embed'
            tooltip={t('Rename Category')}
            value={rowInfo}
            onClick={this.renameCategory.bind(this, rowInfo)}
          >
            <Icon name='pencil' />
          </Button>
        ),
        (
          <Button
            id='add-category'
            className='btn-embed'
            tooltip={t('Add Child Category')}
            onClick={this.addCategory.bind(this, rowInfo)}
          >
            <Icon name='folder-add' />
          </Button>
        ),
        (
          <Button
            id='remove-category'
            className='btn-embed'
            tooltip={t('Remove Category')}
            onClick={this.removeCategory.bind(this, rowInfo)}
          >
            <Icon name='remove' />
          </Button>
        ),
      ],
    };
  }

  private getNodeKey = (args: { node: ICategoriesTree, treeIndex: number }) => {
    return args.node.categoryId;
  }

  private toggleVisibility =
    (args: {treeData: ICategoriesTree[], node: ICategoriesTree, expanded: boolean}) => {
    if (args.expanded) {
      this.nextState.expanded.push(args.node.categoryId);
    } else {
      this.nextState.expanded.splice(this.nextState.expanded.indexOf(args.node.categoryId));
    }
  }

  private moveNode =
    (args: { treeData: ICategoriesTree[], node: ICategoriesTree,
             treeIndex: number, path: string[] }): void => {
    const { gameMode, onSetCategory } = this.props;
    onSetCategory(gameMode, args.node.categoryId, {
      name: args.node.title,
      order: args.node.order,
      parentCategory: args.path[args.path.length - 2],
    });
  }
}

function mapStateToProps(state: any): IConnectedProps {
  const gameMode = activeGameId(state);
  return {
    gameMode,
    language: state.settings.interface.language,
    categories: state.persistent.categories,
    mods: state.persistent.mods[gameMode],
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onRenameCategory: (gameId: string, categoryId: string, newCategory: string) =>
      dispatch(renameCategory(gameId, categoryId, newCategory)),
    onSetCategory: (gameId: string, categoryId: string, category: ICategory) =>
      dispatch(setCategory(gameId, categoryId, category)),
    onRemoveCategory: (gameId: string, categoryId: string) =>
      dispatch(removeCategory(gameId, categoryId)),
    onShowError: (message: string, details: string | Error) =>
      showError(dispatch, message, details),
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      CategoryList))as React.ComponentClass<{}>;
