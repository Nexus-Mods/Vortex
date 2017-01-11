
import { addCategory, removeCategory, renameCategory, updateCategories } from '../actions/category';
import {
  setSearchFocusIndex, setSearchFoundCount,
  setSearchString, setTreeDataObject,
} from '../actions/session';
import { IAddedTree, IRemovedTree, IRenamedTree, IToggleExpandedTree } from '../types/ITrees';
import { convertGameId } from '../util/convertGameId';
import { createTreeDataObject } from '../util/createTreeDataObject';

import { showDialog } from '../../../actions/notifications';
import { IComponentContext } from '../../../types/IComponentContext';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../../types/IDialog';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { showError } from '../../../util/message';
import Icon from '../../../views/Icon';
import IconBar from '../../../views/IconBar';
import { Button } from '../../../views/TooltipControls';

import * as Promise from 'bluebird';
import * as React from 'react';
import { Jumbotron } from 'react-bootstrap';
import Tree from 'react-sortable-tree';

interface IActionProps {
  onShowError: (message: string, details: string | Error) => void;
  onUpdateCategories: (activeGameId: string, categories: any[]) => void;
  onAddCategory: (activeGameId: string, category: {}) => void;
  onRemoveCategory: (activeGameId: string, category: {}) => void;
  onRenameCategory: (activeGameId: string, categoryId: string, newCategory: {}) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
    actions: DialogActions) => Promise<IDialogResult>;
  onSetSearchFocusIndex: (focusIndex: number) => void;
  onSetSearchFoundCount: (foundCount: number) => void;
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
}

interface IComponentState {
  // treeDataObject: {};
}

let TreeImpl: typeof Tree;

interface ICategory {
  categoryId: number;
  name: string;
  parentCategory: number | false;
}

interface ICategoryDic {
  [id: string]: { name: string, parentCategory: string };
};

/**
 * displays the list of savegames installed for the current game.
 * 
 */
class CategoryList extends ComponentEx<IConnectedProps & IActionProps, IComponentState> {

  public context: IComponentContext;

  constructor(props) {
    super(props);
    this.state = {
      treeDataObject: undefined,
    };
  }

  public componentWillMount() {
    const { treeDataObject } = this.props;
    if (treeDataObject === undefined || treeDataObject[0] === null) {
      this.loadTree();
    }
  }

  public render(): JSX.Element {
    const { t, gameMode, searchString, searchFocusIndex,
      searchFoundCount, treeDataObject } = this.props;
    TreeImpl = require('react-sortable-tree').default;

    if (gameMode === undefined) {
      return <Jumbotron>{t('Please select a game first')}</Jumbotron>;
    }

    if (treeDataObject !== undefined) {
      return (
        <div style={{ height: '90%' }}>
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
          <IconBar
            group='categories-icons'
            staticElements={null}
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
            type='submit'
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
          <TreeImpl
            treeData={treeDataObject}
            onChange={this.updateTreeData}
            height={'100%'}
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

  private toggleExpandedForAll = (event) => {
    const {onShowError, onSetTreeDataObject, treeDataObject} = this.props;
    let treeFunctions = require('react-sortable-tree');
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

      let updatedTree = treeFunctions.toggleExpandedForAll(newTree);
      onSetTreeDataObject(updatedTree);

    } catch (err) {
      onShowError('An error occurred expanding/collapsing the categories tree', err);
    }
  }

  private renameCategory = ({ node, path }) => {
    const {gameMode, onShowDialog, onShowError,
      onRenameCategory, onSetTreeDataObject, treeDataObject} = this.props;
    let treeFunctions = require('react-sortable-tree');
    let renameCategory = true;
    onShowDialog('info', 'Rename Category', {
      formcontrol: { id: 'newCategory', type: 'text', value: node.title },
    }, {
        Cancel: null,
        Rename: null,
      }).then((result: IDialogResult) => {
        renameCategory = result.action === 'Rename' && result.input.value !== undefined;
        if (renameCategory) {
          try {
            let nodePath = path;
            let newTree: IRenamedTree = {
              treeData: treeDataObject,
              path: nodePath,
              newNode: {
                rootId: node.rootId, title: result.input.value,
                expanded: node.expanded, parentId: node.parentId, children: node.children,
              },
              getNodeKey: treeFunctions.defaultGetNodeKey,
              ignoreCollapsed: true,
            };

            let updatedTree = treeFunctions.changeNodeAtPath(newTree);

            onRenameCategory(gameMode, node.rootId,
             {name: result.input.value, parentCategory: node.parentId});
            onSetTreeDataObject(updatedTree);

          } catch (err) {
            onShowError('An error occurred renaming the category', err);
          }
        }
      });
  }

  private addCategory = ({ node, path }) => {
    const {categories, gameMode, onShowDialog, onShowError, onAddCategory,
      onSetTreeDataObject, treeDataObject} = this.props;
    let treeFunctions = require('react-sortable-tree');
    let addCategory = true;

    onShowDialog('question', 'Add new Category', {
      formcontrol: { id: 'newCategory', type: 'text', value: '' },
    }, {
        Cancel: null,
        Add: null,
      }).then((result: IDialogResult) => {
        addCategory = result.action === 'Add' && result.input.value !== undefined;
        if (addCategory) {
          try {
            let lastIndex = this.searchLastRootId(categories);
            let newTree: IAddedTree = {
              treeData: treeDataObject,
              newNode: {
                rootId: lastIndex, title: result.input.value,
                expanded: true, parentId: node.rootId,
              },
              parentKey: path[1] === undefined ? path[0] : path[1],
              getNodeKey: treeFunctions.defaultGetNodeKey,
              ignoreCollapsed: true,
              expandParent: true,
            };

            let updatedTree = treeFunctions.addNodeUnderParent(newTree);
            let categoryDict: ICategoryDic = {
              [lastIndex]:
              {
                name: result.input.value, parentCategory: node.rootId,
              },
            };
            onAddCategory(gameMode, categoryDict);
            onSetTreeDataObject(updatedTree.treeData);

          } catch (err) {
            onShowError('An error occurred adding the new category', err);
          }
        }
      });
  }

  private addRootCategory = () => {
    const {categories, gameMode, onShowDialog, onShowError, onAddCategory,
      onSetTreeDataObject, treeDataObject} = this.props;
    let treeFunctions = require('react-sortable-tree');
    let addCategory = true;

    onShowDialog('question', 'Add new Root Category', {
      formcontrol: { id: 'newRootCategory', type: 'text', value: '' },
    }, {
        Cancel: null,
        Add: null,
      }).then((result: IDialogResult) => {
        addCategory = result.action === 'Add' && result.input.value !== undefined;
        if (addCategory) {
          try {
            let lastIndex = this.searchLastRootId(categories);

            let newTree: IAddedTree = {
              treeData: treeDataObject,
              newNode: {
                rootId: lastIndex, title: result.input.value,
                expanded: true, parentId: 0,
              },
              parentKey: undefined,
              getNodeKey: treeFunctions.defaultGetNodeKey,
              ignoreCollapsed: false,
              expandParent: false,
            };

            let updatedTree = treeFunctions.addNodeUnderParent(newTree);
            let categoryDict: ICategoryDic = {
              [lastIndex]:
              {
                name: result.input.value, parentCategory: undefined,
              },
            };
            onAddCategory(gameMode, categoryDict);
            onSetTreeDataObject(updatedTree.treeData);
          } catch (err) {
            onShowError('An error occurred adding the new Root category', err);
          }
        }
      });
  }

  private searchLastRootId(categories: any) {
    const {gameMode} = this.props;
    let maxId = 0;
    Object.keys(categories[gameMode].gameCategories).filter((id: string) => {
      if ( parseInt(id, 10) > maxId) {
        maxId = parseInt(id, 10);
      }
    });
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
    const { categories, gameMode, onShowError, onSetTreeDataObject } = this.props;
    if (categories[gameMode] !== undefined) {
      let gameCategories = categories[gameMode].gameCategories;

      if (gameCategories !== undefined) {
        let createdTree = createTreeDataObject(gameCategories);
        onSetTreeDataObject(createdTree);
      } else {
        onShowError('An error occurred loading the categories. ',
          'Cant read local categories. If you manually edited global_persistent you probably ' +
          'damaged the file. If you didn t, please report a bug and include global_persistent.');
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

  private removeCategory = ({ node, path }) => {
    const {categories, gameMode, onShowError, onRemoveCategory,
      onSetTreeDataObject, treeDataObject} = this.props;
    let treeFunctions = require('react-sortable-tree');
    try {
      let nodePath = path;
      let newTree: IRemovedTree = {
        treeData: treeDataObject,
        path: nodePath,
        getNodeKey: treeFunctions.defaultGetNodeKey,
        ignoreCollapsed: true,
      };

      let updatedTree = treeFunctions.removeNodeAtPath(newTree);
      onSetTreeDataObject(updatedTree);

      let categoryList: any[] =
       Object.keys(categories[gameMode].gameCategories).filter((id: string) => {
          return (id === node.rootId ||
           categories[gameMode].gameCategories[id].parentCategory === node.rootId);
        }
      );

      if (categoryList !== undefined) {
        categoryList.forEach(value => {
        onRemoveCategory(gameMode, value);
        });
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
          <Icon name={'remove'} />
        </Button>,
      ],
    };
    return rowInfo;
  }

  private updateTreeData = (event) => {
    const { onSetTreeDataObject } = this.props;

    onSetTreeDataObject(event);
  }
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onShowError: (message: string, details: string | Error) => {
      showError(dispatch, message, details);
    },
    onUpdateCategories: (activeGameId: string, categories: any[]) => {
      dispatch(updateCategories(activeGameId, categories));
    },
    onRemoveCategory: (activeGameId: string, category: {}) => {
      dispatch(removeCategory(activeGameId, category));
    },
    onAddCategory: (activeGameId: string, category: {}) => {
      dispatch(addCategory(activeGameId, category));
    },
    onRenameCategory: (activeGameId: string, categoryId: string, newCategory: {}) => {
      dispatch(renameCategory(activeGameId, categoryId, newCategory));
    },
    onSetSearchString: (text: string) => {
      dispatch(setSearchString(text));
    },
    onSetSearchFocusIndex: (focusIndex: number) => {
      dispatch(setSearchFocusIndex(focusIndex));
    },
    onSetSearchFoundCount: (foundCount: number) => {
      dispatch(setSearchFoundCount(foundCount));
    },
    onSetTreeDataObject: (tree: {}) => {
      dispatch(setTreeDataObject(tree));
    },
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
  };
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    gameMode: convertGameId(state.settings.gameMode.current),
    language: state.settings.interface.language,
    categories: state.persistent.categories,
    searchString: state.session.categories.searchString,
    searchFocusIndex: state.session.categories.searchFocusIndex,
    searchFoundCount: state.session.categories.searchFoundCount,
    treeDataObject: state.session.categories.treeDataObject,
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(CategoryList)
  ) as React.ComponentClass<{}>;
