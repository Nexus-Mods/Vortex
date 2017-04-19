import { showDialog } from '../../../actions/notifications';
import { IComponentContext } from '../../../types/IComponentContext';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../../types/IDialog';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import lazyRequire from '../../../util/lazyRequire';
import { showError } from '../../../util/message';
import { activeGameId } from '../../../util/selectors';
import Icon from '../../../views/Icon';
import IconBar from '../../../views/IconBar';
import { Button } from '../../../views/TooltipControls';

import { renameCategory, updateCategories } from '../actions/category';
import * as sessionActions from '../actions/session';
import { ICategoryDictionary } from '../types/IcategoryDictionary';
import { IAddedTree, IRemovedTree, IRenamedTree,
  IToggleExpandedTree, ITreeDataObject } from '../types/ITrees';
import createCategoryDictionary from '../util/createCategoryDictionary';
import createTreeDataObject from '../util/createTreeDataObject';
import generateSubtitle from '../util/generateSubtitle';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as path from 'path';
import * as React from 'react';
import * as SortableTreeT from 'react-sortable-tree';

const tree = lazyRequire<typeof SortableTreeT>('react-sortable-tree');

interface IActionProps {
  onShowError: (message: string, details: string | Error) => void;
  onUpdateCategories: (activeGameId: string, categories: ICategoryDictionary) => void;
  onRenameCategory: (activeGameId: string, categoryId: string, newCategory: {}) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
    actions: DialogActions) => Promise<IDialogResult>;
  onSetSearchFocusIndex: (focusIndex: number) => void;
  onSetSearchFoundCount: (foundCount: number) => void;
  onShowHiddenCategories: (showHidden: boolean) => void;
  onSetSearchString: (text: string) => void;
  onSetTreeDataObject: (tree: {}) => void;
}

interface IConnectedProps {
  gameMode: string;
  language: string;
  categories: [ICategory];
  searchString: string;
  searchFocusIndex: number;
  searchFoundCount: number;
  treeDataObject: {};
  mods: any;
  showHidden: boolean;
}

interface ICategory {
  categoryId: number;
  name: string;
  parentCategory: number | false;
}

/**
 * displays the list of categories related for the current game.
 * 
 */
class CategoryList extends ComponentEx<IConnectedProps & IActionProps, {}> {

  public context: IComponentContext;

  constructor(props) {
    super(props);
    this.state = {
      treeDataObject: undefined,
    };
  }

  public componentWillMount() {
      this.loadTree();
  }

  public render(): JSX.Element {
    const { t, searchString, searchFocusIndex,
      searchFoundCount, treeDataObject } = this.props;

    const Tree = tree.SortableTreeWithoutDndContext;
    if (treeDataObject !== undefined) {
      return (
        <div style={{ height: 500 }}>
          <Button
            id='expandAll'
            tooltip={t('Expand All')}
            value='true'
            onClick={this.toggleExpandedForAll}
          >
            <Icon name={'expand'} />
          </Button>
          <Button
            id='collapseAll'
            tooltip={t('Collapse All')}
            value='false'
            onClick={this.toggleExpandedForAll}
          >
            <Icon name={'compress'} />
          </Button>
          <Button
            id='add-root-category'
            tooltip={t('Add Root Category')}
            onClick={this.addRootCategory}
          >
            <Icon name={'indent'} />
          </Button>
          <Button
            id='hide-show-empty-categories'
            tooltip={t('Hide / Show empty categories')}
            onClick={this.showHiddenCategories}
          >
            <Icon name={'low-vision'} />
          </Button>
          <IconBar
            group='categories-icons'
            staticElements={[]}
          />
          <label>
            Search:&nbsp;
          <input
              id='find-box'
              type='text'
              value={searchString === undefined ? '' : searchString}
              onChange={this.searchString}
          />
          </label>
          <Button
            id='selectPrevMatch'
            tooltip={t('Prev')}
            type='button'
            disabled={!searchFoundCount}
            onClick={this.selectPrevMatch}
          >
            &lt;
          </Button>
          <Button
            id='selectNextMatch'
            tooltip={t('Next')}
            type='button'
            disabled={!searchFoundCount}
            onClick={this.selectNextMatch}
          >
            &gt;
          </Button>
          <span>
            &nbsp;
          {searchFoundCount > 0 ? (searchFocusIndex + 1) : 0}
            &nbsp;/&nbsp;
          {searchFoundCount || 0}
          </span>

          <Tree
            treeData={treeDataObject}
            onChange={this.updateTreeData}
            style={{ height: '95%' }}
            autoHeight={false}
            searchQuery={searchString}
            searchFocusOffset={searchFocusIndex}
            searchFinishCallback={this.searchFinishCallback}
            generateNodeProps={this.generateNodeProps}
          />
        </div>
      );
    } else {
      return (
        <div style={{ height: '90%' }}>
          <Button
            id='add-category'
            tooltip={t('Add Category')}
            onClick={this.addRootCategory}
          >
            <Icon name={'indent'} />
          </Button>
          <IconBar
            group='categories-icons'
            staticElements={null}
          />
        </div>
      );
    }
  }

  private showHiddenCategories = () => {
    const {categories, gameMode, showHidden, mods,
       onShowError, onShowHiddenCategories, onSetTreeDataObject} = this.props;

    try {
      let createdTree = createTreeDataObject(categories[gameMode],
       mods, showHidden !== undefined ? !showHidden : false);
      onSetTreeDataObject(createdTree);
      onShowHiddenCategories(!showHidden);

    } catch (err) {
      onShowError('An error occurred hiding/showing the empty categories', err);
    }
  }

  private toggleExpandedForAll = (event) => {
    const {onShowError, onSetTreeDataObject, treeDataObject} = this.props;
    let expanded: boolean;

    if (event.currentTarget === undefined) {
      expanded = true;
    } else {
      expanded = event.currentTarget.value === 'true' ? true : false;
    }

    try {
      let isExpanded = expanded;
      let newTree: IToggleExpandedTree = {
        treeData: treeDataObject,
        expanded: isExpanded,
      };

      let updatedTree = tree.toggleExpandedForAll(newTree);
      onSetTreeDataObject(updatedTree);

    } catch (err) {
      onShowError('An error occurred expanding/collapsing the categories tree', err);
    }
  }

  private renameCategory = ({ node, path }) => {
    const {gameMode, onShowDialog, onShowError,
      onRenameCategory, onSetTreeDataObject, treeDataObject} = this.props;
    onShowDialog('info', 'Rename Category', {
      formcontrol: [{ id: 'newCategory', type: 'text', value: node.title, label: 'Category' }],
    }, {
        Cancel: null,
        Rename: null,
      }).then((result: IDialogResult) => {
        const renameCategory = result.action === 'Rename' && result.input.newCategory !== undefined;
        if (renameCategory) {
          try {
            let nodePath = path;
            let newTree: IRenamedTree = {
              treeData: treeDataObject,
              path: nodePath,
              newNode: {
                rootId: node.rootId, title: result.input.newCategory,
                subtitle: node.subtitle, expanded: node.expanded,
                parentId: node.parentId, children: node.children,
              },
              getNodeKey: tree.defaultGetNodeKey,
              ignoreCollapsed: true,
            };

            const updatedTree = tree.changeNodeAtPath(newTree);

            onRenameCategory(gameMode, node.rootId,
              { name: result.input.newCategory, parentCategory: node.parentId, order: node.order });
            onSetTreeDataObject(updatedTree);

          } catch (err) {
            onShowError('An error occurred renaming the category', err);
          }
        }
      });
  }

  private addCategory = ({ node, path }) => {
    const {categories, gameMode, showHidden, mods, onShowDialog, onShowError,
      onSetTreeDataObject, onUpdateCategories, t, treeDataObject} = this.props;
    let addCategory = true;
    let lastIndex = this.searchLastRootId(categories);

    onShowDialog('question', 'Add new Category', {
      formcontrol: [
        { id: 'newCategory', type: 'text', value: '', label: 'Category Name' },
        {
          id: 'newCategoryId', type: 'text', value: lastIndex.toString(),
          label: 'Category ID',
        },
      ],
    }, {
        Cancel: null,
        Add: null,
      }).then((result: IDialogResult) => {
        addCategory = result.action === 'Add';
        if (addCategory) {
          let checkId = Object.keys(categories[gameMode]).filter((id: string) =>
            id === result.input.newCategoryId);
          if (checkId.length !== 0) {
            onShowError('An error occurred adding the new category', 'ID already used.');
          } else if (result.input.newCategoryId === '') {
            onShowError('An error occurred adding the new category', 'Category ID empty.');
          } else {
            try {
              let newTree: IAddedTree = {
                treeData: treeDataObject,
                newNode: {
                  rootId: result.input.newCategoryId,
                  title: result.input.newCategory,
                  subtitle: mods !== undefined ?
                  t(generateSubtitle(result.input.newCategoryId, mods)) : '',
                  expanded: true,
                  parentId: node.rootId,
                },
                parentKey: path[1] === undefined ? path[0] : path[1],
                getNodeKey: tree.defaultGetNodeKey,
                ignoreCollapsed: true,
                expandParent: true,
              };

              let updatedTree = tree.addNodeUnderParent(newTree);

              onSetTreeDataObject(updatedTree.treeData);
              if (showHidden) {
                this.showHiddenCategories();
              }

              if (showHidden !== undefined && !showHidden) {
                let categoryDictionary: ICategoryDictionary =
                 createCategoryDictionary(updatedTree.treeData);
                onUpdateCategories(gameMode, categoryDictionary);
              }

            } catch (err) {
              onShowError('An error occurred adding the new category', err);
            }
          }
        }
      });
  }

  private addRootCategory = () => {
    const {categories, gameMode, showHidden, mods, onShowDialog, onShowError,
      onSetTreeDataObject, onUpdateCategories, t, treeDataObject} = this.props;
    let addCategory = true;
    let lastIndex = this.searchLastRootId(categories);

    onShowDialog('question', 'Add new Root Category', {
      formcontrol: [
        { id: 'newCategory', type: 'text', value: '', label: 'Category Name' },
        {
          id: 'newCategoryId', type: 'text', value: lastIndex.toString(),
          label: 'Category ID',
        },
      ],
    }, {
        Cancel: null,
        Add: null,
      }).then((result: IDialogResult) => {
        addCategory = result.action === 'Add';
        if (addCategory) {
          let checkId = Object.keys(categories[gameMode]).filter((id: string) =>
            id === result.input.newCategoryId);
          if (checkId.length !== 0) {
            onShowError('An error occurred adding the new category', 'ID already used.');
          } else if (result.input.newCategoryId === '') {
            onShowError('An error occurred adding the new category', 'Category ID empty.');
          } else {
            try {
              let newTree: IAddedTree = {
                treeData: treeDataObject,
                newNode: {
                  rootId: result.input.newCategoryId,
                  title: result.input.newCategory,
                  subtitle: mods !== undefined ?
                  t(generateSubtitle(result.input.newCategoryId, mods)) : '',
                  expanded: true,
                  parentId: undefined,
                },
                parentKey: undefined,
                getNodeKey: tree.defaultGetNodeKey,
                ignoreCollapsed: false,
                expandParent: false,
              };

              let updatedTree = tree.addNodeUnderParent(newTree);

              onSetTreeDataObject(updatedTree.treeData);
              if (showHidden) {
                this.showHiddenCategories();
              }

              if (showHidden !== undefined && !showHidden) {
                let categoryDictionary: ICategoryDictionary =
                 createCategoryDictionary(updatedTree.treeData);
                onUpdateCategories(gameMode, categoryDictionary);
              }

            } catch (err) {
              onShowError('An error occurred adding the new Root category', err);
            }
          }
        }
      });
  }

  private searchLastRootId(categories: Object) {
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
    const { onSetSearchFocusIndex, searchFocusIndex, searchFoundCount } = this.props;

    if (searchFocusIndex !== null) {
      onSetSearchFocusIndex((searchFoundCount + searchFocusIndex - 1) % searchFoundCount);
    } else {
      onSetSearchFocusIndex(searchFoundCount - 1);
    }
  }

  private selectNextMatch = () => {
    const { onSetSearchFocusIndex, searchFocusIndex, searchFoundCount } = this.props;

    if (searchFocusIndex !== null) {
      onSetSearchFocusIndex((searchFocusIndex + 1) % searchFoundCount);
    } else {
      onSetSearchFocusIndex(0);
    }
  }

  private loadTree() {
    const { categories, gameMode, showHidden,  mods, onShowError,
       onShowHiddenCategories, onSetTreeDataObject} = this.props;

    if (showHidden === undefined) {
      onShowHiddenCategories(false);
    }

    if (categories[gameMode] !== undefined) {
      if (categories[gameMode].length !== 0) {
        let createdTree = createTreeDataObject(categories[gameMode], mods, false);

        onSetTreeDataObject(createdTree);
      } else {
        const globalPersistentPath = path.join(remote.app.getPath('userData'), 'state');
        onShowError('An error occurred loading the categories.',
          'Can\'t read local categories. If you manually edited global_persistent you probably ' +
          'damaged the file. If you did\'t, please report a bug and include the ' +
          'global_persistent file. You can find it here:' + globalPersistentPath);
      }
    }
  }

  private searchString = (event) => {
    const { onSetSearchString} = this.props;
    onSetSearchString(event.target.value);
  }

  private searchFinishCallback = (event) => {
    const {onSetSearchFocusIndex, onSetSearchFoundCount, searchFocusIndex} = this.props;
    onSetSearchFoundCount(event.length);
    onSetSearchFocusIndex(event.length > 0 ? searchFocusIndex % event.length : 0);
  };

  private removeCategory = ({ path }) => {
    const {gameMode, showHidden, onShowError,
      onSetTreeDataObject, onUpdateCategories, treeDataObject} = this.props;
    try {
      const nodePath = path;
      const newTree: IRemovedTree = {
        treeData: treeDataObject,
        path: nodePath,
        getNodeKey: tree.defaultGetNodeKey,
        ignoreCollapsed: true,
      };

      let updatedTree = tree.removeNodeAtPath(newTree);
      onSetTreeDataObject(updatedTree);

      if (showHidden) {
        this.showHiddenCategories();
      }

      if (showHidden === false) {
        const categoryDictionary: ICategoryDictionary =
          createCategoryDictionary(updatedTree);
        onUpdateCategories(gameMode, categoryDictionary);
      }
    } catch (err) {
      onShowError('An error occurred deleting the category', err);
    }
  };

  private generateNodeProps = (rowInfo) => {
    const {t} = this.props;
    rowInfo = {
      buttons: [
        <Button
          id='rename-category'
          className='btn-embed'
          tooltip={t('Rename Category')}
          value={rowInfo}
          onClick={this.renameCategory.bind(this, rowInfo)}
        >
          <Icon name={'pencil'} />
        </Button>,
        <Button
          id='add-category'
          className='btn-embed'
          tooltip={t('Add Category')}
          onClick={this.addCategory.bind(this, rowInfo)}
        >
          <Icon name={'indent'} />
        </Button>,
        <Button
          id='remove-category'
          className='btn-embed'
          tooltip={t('Remove Category')}
          onClick={this.removeCategory.bind(this, rowInfo)}
        >
          <Icon name='remove' />
        </Button>,
      ],
    };
    return rowInfo;
  }

  private updateTreeData = (treeDataObject: ITreeDataObject[]) => {
    const { gameMode, showHidden, onSetTreeDataObject,
       onUpdateCategories } = this.props;
    let categories: ICategoryDictionary = createCategoryDictionary(treeDataObject);
    if (showHidden !== undefined && !showHidden) {
      onUpdateCategories(gameMode, categories);
    }
    onSetTreeDataObject(treeDataObject);
  }
}

function mapStateToProps(state: any): IConnectedProps {
  const gameMode = activeGameId(state);
  return {
    gameMode,
    language: state.settings.interface.language,
    categories: state.persistent.categories,
    searchString: state.session.categories.searchString,
    searchFocusIndex: state.session.categories.searchFocusIndex,
    searchFoundCount: state.session.categories.searchFoundCount,
    treeDataObject: state.session.categories.treeDataObject,
    mods: state.persistent.mods[gameMode],
    showHidden: state.session.categories.isHidden,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onUpdateCategories: (activeGameId: string, categories: ICategoryDictionary) =>
      dispatch(updateCategories(activeGameId, categories)),
    onRenameCategory: (activeGameId: string, categoryId: string, newCategory: string) =>
      dispatch(renameCategory(activeGameId, categoryId, newCategory)),
    onSetSearchString: (text: string) =>
      dispatch(sessionActions.setSearchString(text)),
    onSetSearchFocusIndex: (focusIndex: number) =>
      dispatch(sessionActions.setSearchFocusIndex(focusIndex)),
    onSetSearchFoundCount: (foundCount: number) =>
      dispatch(sessionActions.setSearchFoundCount(foundCount)),
    onShowHiddenCategories: (showHidden: boolean) =>
      dispatch(sessionActions.showHiddenCategories(showHidden)),
    onSetTreeDataObject: (treeObject: {}) =>
      dispatch(sessionActions.setTreeDataObject(treeObject)),
    onShowError: (message: string, details: string | Error) =>
      showError(dispatch, message, details),
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(CategoryList)
  ) as React.ComponentClass<{}>;
