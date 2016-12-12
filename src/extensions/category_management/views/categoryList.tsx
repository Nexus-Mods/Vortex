import { ComponentEx, connect, translate } from '../../../util/ComponentEx';

import Icon from '../../../views/Icon';
import { Button } from '../../../views/TooltipControls';

import * as React from 'react';

import { ICategory } from '../types/ICategory';

import Tree from 'react-sortable-tree';

import update = require('react-addons-update');

interface IProps {
  objects: ICategory[];
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
class CategoryList extends ComponentEx<IProps & IConnectedProps, IComponentState> {

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
          generateNodeProps={this.generaterowInfo}
        />
      </div>
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

  private generaterowInfo = (evt) => {
    let rowInfo: {} = {
      buttons: [<Button
        id='1'
        className='btn-embed'
        tooltip='Add Category'
      >
        <Icon name={'pencil'} />
      </Button>],
    };

    return rowInfo;
  }

  private updateTreeData = (event) => {
    this.setState(update(this.state, {
      treeDataObject: { $set: event },
    }));
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    gameMode: state.settings.gameMode.current,
    language: state.settings.interface.language,
    categories: state.session.categories.categories,
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps)(CategoryList)
  ) as React.ComponentClass<{}>;
