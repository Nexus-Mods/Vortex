import { ComponentEx, connect, translate } from '../../../util/ComponentEx';

import Icon from '../../../views/Icon';
import { Button } from '../../../views/TooltipControls';

import { ICategory } from '../types/ICategory';
import { IGameListEntry } from '../types/IGameListEntry';
import { Jumbotron } from 'react-bootstrap';

import { showDialog } from '../../../actions/notifications';
import { showError } from '../../../util/message';

import * as React from 'react';

import { getSafe } from '../../../util/storeHelper';

import { convertGameId } from '../util/convertGameId';
import { retriveCategoryList } from '../util/retrieveCategories';

import * as Promise from 'bluebird';

import Tree from 'react-sortable-tree';

import update = require('react-addons-update');

import { updateCategories } from '../actions/category';

import { IComponentContext } from '../../../types/IComponentContext';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../../types/IDialog';
import Nexus from 'nexus-api';

let nexus: Nexus;

interface IGameInfo extends IGameListEntry {
  categories: ICategory[];
}

interface IActionProps {
  onShowError: (message: string, details: string | Error) => void;
  onUpdateCategories: (activeGameId: string, categories: any[]) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
    actions: DialogActions) => Promise<IDialogResult>;
}

interface IConnectedProps {
  gameMode: string;
  language: string;
  categories: [{ title: string, children: [{ title: string }] }];
}

interface IComponentState {
  treeDataObject: {};
  searchString: string;
  searchFocusIndex: number;
  searchFoundCount: number;
}

let TreeImpl: typeof Tree;

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
      searchString: '',
      searchFocusIndex: 0,
      searchFoundCount: null,
    };
  }

  public componentWillMount() {
    const { treeDataObject } = this.state;
    if (treeDataObject === undefined) {
      this.loadTree();
    }
  }

  public render(): JSX.Element {
    const { searchString, searchFocusIndex, searchFoundCount, treeDataObject } = this.state;
    const { t, gameMode } = this.props;
    TreeImpl = require('react-sortable-tree').default;

    if (gameMode === undefined) {
      return <Jumbotron>{t('Please select a game first')}</Jumbotron>;
    }

    if (treeDataObject !== undefined) {
      return (
        <div style={{ height: 1000 }}>
          <Button
            id='expandAll'
            tooltip='Expand All'
            value='true'
            onClick={this.toggleExpandedForAllJS}
          >
            <Icon name={'expand'} />
          </Button>
          <Button
            id='collapseAll'
            tooltip='Collapse All'
            value='false'
            onClick={this.toggleExpandedForAllJS}
          >
            <Icon name={'compress'} />
          </Button>
          <Button
            id='retrieveCategories'
            tooltip='Retrieve Categories from server'
            onClick={this.retrieveCategories}
          >
            <Icon name={'download'} />
          </Button>
          <Button
            id='add-root-category'
            tooltip='Add Root Category'
            onClick={this.addRootCategory}
          >
          <Icon name={'indent'} />
          </Button>
          <label>
            Search:&nbsp;
          <input
              id='find-box'
              type='text'
              value={searchString}
              onChange={this.searchString}
          />
          </label>
          <Button
            id='selectPrevMatch'
            tooltip='Prev'
            type='button'
            disabled={!searchFoundCount}
            onClick={this.selectPrevMatch}
          >
            &lt;
          </Button>
          <Button
            id='selectNextMatch'
            tooltip='Next'
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
            searchQuery={searchString}
            searchFocusOffset={searchFocusIndex}
            searchFinishCallback={this.searchFinishCallback}
            generateNodeProps={this.generateNodeProps}
          />
        </div>
      );
    } else {
      return (
        <div style={{ height: 1000 }}>
          <Button
            id='retrieveCategories'
            tooltip='Retrieve Categories from server'
            onClick={this.retrieveCategories}
          >
            <Icon name={'download'} />
          </Button>
          <Button
            id='add-category'
            tooltip='Add Category'
            onClick={this.addRootCategory}
          >
          <Icon name={'indent'} />
          </Button>
        </div>
      );
    }
  }

  private toggleExpandedForAllJS = (event) => {
    const {treeDataObject} = this.state;
    const {gameMode, onShowError, onUpdateCategories} = this.props;
    let treeFunctions = require('react-sortable-tree');
    let expanded: boolean;

    if (event.currentTarget === undefined) {
      expanded = true;
    } else {
      expanded = event.currentTarget.value === 'true' ? true : false;
    }

    try {
      let isExpanded = expanded;
      let newTree: ({
        treeData: {},
        expanded: boolean,
      }) = {
          treeData: treeDataObject,
          expanded: isExpanded,
        };

      let updatedTree = treeFunctions.toggleExpandedForAll(newTree);
      onUpdateCategories(gameMode, updatedTree);
      this.setState(update(this.state, {
        treeDataObject: { $set: updatedTree },
      }));

    } catch (err) {
      onShowError('An error occurred expanding/collapsing the categories tree', err);
    }
  }

  private renameCategory = ({ node, path }) => {
    const {treeDataObject} = this.state;
    const {gameMode, onShowDialog, onShowError, onUpdateCategories} = this.props;
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
            let newTree: ({
              treeData: {},
              path: string[],
              newNode: {},
              getNodeKey: Function,
              ignoreCollapsed: boolean
            }) = {
                treeData: treeDataObject,
                path: nodePath,
                newNode: { title: result.input.value, expanded: node.expanded,
                   children: node.children },
                getNodeKey: treeFunctions.defaultGetNodeKey,
                ignoreCollapsed: true,
              };

            let updatedTree = treeFunctions.changeNodeAtPath(newTree);

            onUpdateCategories(gameMode, updatedTree);

            this.setState(update(this.state, {
              treeDataObject: { $set: updatedTree },
            }));

          } catch (err) {
            onShowError('An error occurred renaming the category', err);
          }
        }
      });
  }

  private addCategory = ({ path }) => {
    const {treeDataObject} = this.state;
    const {gameMode, onShowDialog, onShowError, onUpdateCategories} = this.props;
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
            let newTree: ({
              treeData: {},
              newNode: {},
              parentKey: number | string,
              getNodeKey: Function,
              ignoreCollapsed: boolean,
              expandParent: boolean,
            }) = {
                treeData: treeDataObject,
                newNode: { title: result.input.value, expanded: true },
                parentKey: path[1] === undefined ? path[0] : path[1],
                getNodeKey: treeFunctions.defaultGetNodeKey,
                ignoreCollapsed: true,
                expandParent: true,
              };

            let updatedTree = treeFunctions.addNodeUnderParent(newTree);
            onUpdateCategories(gameMode, updatedTree.treeData);

            this.setState(update(this.state, {
              treeDataObject: { $set: updatedTree.treeData },
            }));

          } catch (err) {
            onShowError('An error occurred adding the new category', err);
          }
        }
      });
  }

  private addRootCategory = () => {
    const {treeDataObject} = this.state;
    const {gameMode, onShowDialog, onShowError, onUpdateCategories} = this.props;
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
            let newTree: ({
              treeData: {},
              newNode: {},
              parentKey: number | string,
              getNodeKey: Function,
              ignoreCollapsed: boolean,
              expandParent: boolean,
            }) = {
                treeData: treeDataObject,
                newNode: { title: result.input.value, expanded: true },
                parentKey: undefined,
                getNodeKey: treeFunctions.defaultGetNodeKey,
                ignoreCollapsed: false,
                expandParent: false,
              };

            let updatedTree = treeFunctions.addNodeUnderParent(newTree);
            onUpdateCategories(gameMode, updatedTree.treeData);

            this.setState(update(this.state, {
              treeDataObject: { $set: updatedTree.treeData },
            }));

          } catch (err) {
            onShowError('An error occurred adding the new Root category', err);
          }
        }
      });
  }

  private retrieveCategories = () => {
    const { gameMode, onShowDialog } = this.props;
    let state = this.context.api.store.getState();
    let retrieve = false;

    onShowDialog('question', 'Retrieve Categories', {
      message: 'Clicking RETRIEVE you will lose all your changes',
    }, {
        Cancel: null,
        Retrieve: null,
      }).then((dialogResult: IDialogResult) => {
        retrieve = dialogResult.action === 'Retrieve';
        if (retrieve) {
          nexus = new Nexus(
            getSafe(state, ['settings', 'gameMode', 'current'], ''),
            getSafe(state, ['account', 'nexus', 'APIKey'], '')
          );

          let gameId = convertGameId(gameMode);
          retriveCategoryList(gameId, nexus, true)
            .then((result: any) => {
              this.setState(update(this.state, {
                treeDataObject: { $set: result },
              }));
            });
        }
      }
      );
  }

  private selectPrevMatch = () => {
    const {  searchFocusIndex, searchFoundCount } = this.state;

    if (searchFocusIndex !== null) {
      this.setState(update(this.state, {
        searchFocusIndex: {
          $set: ((searchFoundCount + searchFocusIndex - 1)
            % searchFoundCount),
        },
      }));
    } else {
      this.setState(update(this.state, {
        searchFocusIndex: { $set: searchFoundCount - 1 },
      }));
    }
  }

  private searchFinishCallback = (event) => {
    const { searchFocusIndex } = this.state;
    this.setState(update(this.state, {
      searchFoundCount: { $set: event.length },
      searchFocusIndex: { $set: event.length > 0 ? searchFocusIndex % event.length : 0 },
    }));
  };

  private selectNextMatch = () => {
    const {  searchFocusIndex, searchFoundCount } = this.state;

    if (searchFocusIndex !== null) {
      this.setState(update(this.state, {
        searchFocusIndex: { $set: ((searchFocusIndex + 1) % searchFoundCount) },
      }));
    } else {
      this.setState(update(this.state, {
        searchFocusIndex: { $set: 0 },
      }));
    }
  }

  private loadTree() {
    const { categories, gameMode, onShowError } = this.props;
    if (categories[gameMode] !== undefined) {
      let gameCategories = categories[gameMode].gameCategories;

      if (gameCategories !== undefined) {
        this.setState(update(this.state, {
          treeDataObject: { $set: gameCategories },
        }));
      } else {
        onShowError('An error occurred loading the categories. ',
        'Cant read local categories. If you manually edited global_persistent you probably ' +
        'damaged the file. If you didn t, please report a bug and include global_persistent.');
      }
    }
  }

  private searchString = (event) => {
    this.setState(update(this.state, {
      searchString: { $set: event.target.value },
    }));
  }

  private removeCategory = ({ path }) => {
    const {treeDataObject} = this.state;
    const {gameMode, onShowError, onUpdateCategories} = this.props;
    let treeFunctions = require('react-sortable-tree');
    try {
      let nodePath = path;
      let newTree: ({
        treeData: {}, path: any, getNodeKey: Function,
        ignoreCollapsed: boolean
      }) = {
          treeData: treeDataObject,
          path: nodePath,
          getNodeKey: treeFunctions.defaultGetNodeKey,
          ignoreCollapsed: false,
        };

      let updatedTree = treeFunctions.removeNodeAtPath(newTree);
      this.setState(update(this.state, {
        treeDataObject: { $set: updatedTree },
      }));

      onUpdateCategories(gameMode, updatedTree);

    } catch (err) {
      onShowError('An error occurred deleting the category', err);
    }

  };

  private generateNodeProps = (rowInfo) => {
    rowInfo = {
      buttons: [
        <Button
          id='rename-category'
          className='btn-embed'
          tooltip='Rename Category'
          value={rowInfo}
          onClick={this.renameCategory.bind(this, rowInfo)}
        >
          <Icon name={'pencil'} />
        </Button>,
        <Button
          id='add-category'
          className='btn-embed'
          tooltip='Add Category'
          onClick={this.addCategory.bind(this, rowInfo)}
        >
          <Icon name={'indent'} />
        </Button>,
        <Button
          id='remove-category'
          className='btn-embed'
          tooltip='Remove Category'
          onClick={this.removeCategory.bind(this, rowInfo)}
        >
          <Icon name={'remove'} />
        </Button>,
      ],
    };
    return rowInfo;
  }

  private updateTreeData = (event) => {
    const { gameMode, onUpdateCategories } = this.props;

    onUpdateCategories(gameMode, event);

    this.setState(update(this.state, {
      treeDataObject: { $set: event },
    }));
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
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
  };
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    gameMode: state.settings.gameMode.current,
    language: state.settings.interface.language,
    categories: state.persistent.categories,
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(CategoryList)
  ) as React.ComponentClass<{}>;
