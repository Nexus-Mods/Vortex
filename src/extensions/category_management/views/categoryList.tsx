import { ComponentEx, connect, translate } from '../../../util/ComponentEx';

import Icon from '../../../views/Icon';
import { Button } from '../../../views/TooltipControls';

import { showError } from '../../../util/message';

import * as React from 'react';

import { ICategory } from '../types/ICategory';

import Tree from 'react-sortable-tree';

import update = require('react-addons-update');

import { removeCategory } from '../actions/category';

interface IProps {
  objects: ICategory[];
}

interface IActionProps {
  onRemoveCategory: (category: string) => void;
  onShowError: (message: string, details: string | Error) => void;
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
class CategoryList extends ComponentEx<IProps & IConnectedProps & IActionProps, IComponentState> {

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
    const {  searchString, searchFocusIndex, searchFoundCount, treeDataObject } = this.state;
    TreeImpl = require('react-sortable-tree').default;

    return (
      <div style={{ height: 1000 }}>
        <Button id='expandAll' tooltip='Expand All' onClick={this.expandAll}>
          Expand All
        </Button>
        <Button id='collapseAll' tooltip='Collapse All' onClick={this.collapseAll}>
          Collapse All
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
          generateNodeProps={rowInfo => ({
            buttons: [
              <Button
                id='add-category'
                className='btn-embed'
                tooltip='Add Category'
                onClick={() => this.addJSCategory(rowInfo)}
              >
                <Icon name={'pencil'} />
              </Button>,
              <Button
                id='remove-category'
                className='btn-embed'
                tooltip='Remove Category'
                onClick={() => this.removeJSCategory(rowInfo)}
              >
                <Icon name={'remove'} />
              </Button>,
            ],
          })}
          // generateNodeProps={this.generaterowInfo}
        />
      </div>
    );
  }

  private addJSCategory = ({ node, path }) => {
    const {treeDataObject} = this.state;
    const {onShowError} = this.props;
    let treeFunctions = require('react-sortable-tree');
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
          newNode: { title: 'testName', expanded: true },
          parentKey: node.rootId,
          getNodeKey: treeFunctions.defaultGetNodeKey,
          ignoreCollapsed: false,
          expandParent: false,
        };

      let updatedTree = treeFunctions.addNodeUnderParent(newTree);
      this.setState(update(this.state, {
        treeDataObject: { $set: updatedTree.treeData },
      }));

    } catch (err) {
      onShowError('An error occurred during the add category', err);
    }
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
  }

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
    const { categories } = this.props;
    this.setState(update(this.state, {
      treeDataObject: { $set: categories },
    }));
  }

  private toggleExpandedForAll = (treeData: any, expanded: boolean) => {

    treeData.forEach(element => {
      element.expanded = expanded;
    });
    return treeData;
  }

  private expandAll = (event) => {
    const { treeDataObject } = this.state;

    let expandedTree = this.toggleExpandedForAll(treeDataObject, true);

    this.setState(update(this.state, {
      treeData: { $set: expandedTree },
    }));
  }

  private collapseAll = (event) => {
    const { treeDataObject } = this.state;

    let collapsedTree = this.toggleExpandedForAll(treeDataObject, false);

    this.setState(update(this.state, {
      treeData: { $set: collapsedTree },
    }));
  }

  private searchString = (event) => {
    this.setState(update(this.state, {
      searchString: { $set: event.target.value },
    }));
  }

  private removeJSCategory = ({ node, path }) => {
    const {treeDataObject} = this.state;
    const {gameMode, onRemoveCategory, onShowError} = this.props;

    let treeFunctions = require('react-sortable-tree');
    try {
      let newTree: ({
        treeData: {}, path: any, getNodeKey: Function,
        ignoreCollapsed: boolean
      }) = {
          treeData: treeDataObject,
          path: path,
          getNodeKey: treeFunctions.defaultGetNodeKey,
          ignoreCollapsed: false,
        };

      let updatedTree = treeFunctions.removeNodeAtPath(newTree);
      this.setState(update(this.state, {
        treeDataObject: { $set: updatedTree },
      }));

    } catch (err) {
      onShowError('An error occurred during the delete category', err);
    }
    // onRemoveCategory(gameMode, path[0], node);
  };

  private generaterowInfo = (evt) => {
    let value = evt.node.title;
    let rowInfo: {} = {
      buttons: [<button
        id='add-category'
        className='btn-embed'
        tooltip='Add Category'
        value={value}
        onClick={this.removeCategory}
      >
        <Icon name={'pencil'} />
      </button>],
    };

    return rowInfo;
  }

  private removeCategory = () => {
    const { onRemoveCategory } = this.props;
    // onRemoveCategory(event.target.value);
  }

  private updateTreeData = (event) => {
    this.setState(update(this.state, {
      treeDataObject: { $set: event },
    }));
  }
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onRemoveCategory: (category: string) => {
      dispatch(removeCategory(category));
    },
    onShowError: (message: string, details: string | Error) => {
      showError(dispatch, message, details);
    },
  };
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    gameMode: state.settings.gameMode.current,
    language: state.settings.interface.language,
    categories: state.persistent.categories.categories,
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(CategoryList)
  ) as React.ComponentClass<{}>;
