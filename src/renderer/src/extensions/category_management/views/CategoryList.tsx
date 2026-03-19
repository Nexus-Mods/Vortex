import { showDialog } from "../../../actions/notifications";
import ActionDropdown from "../../../controls/ActionDropdown";
import Icon from "../../../controls/Icon";
import IconBar from "../../../controls/IconBar";
import { IconButton } from "../../../controls/TooltipControls";
import type { IActionDefinition } from "../../../types/IActionDefinition";
import type { IComponentContext } from "../../../types/IComponentContext";
import type {
  DialogActions,
  DialogType,
  IConditionResult,
  IDialogContent,
  IDialogResult,
  IInput,
} from "../../../types/IDialog";
import type { IErrorOptions } from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import { ComponentEx, connect, translate } from "../../../controls/ComponentEx";
import lazyRequire from "../../../util/lazyRequire";
import { showError } from "../../../util/message";
import { activeGameId } from "../../../util/selectors";

import type { IMod } from "../../mod_management/types/IMod";

import {
  removeCategory,
  renameCategory,
  setCategory,
  setCategoryOrder,
} from "../actions/category";
import type {
  ICategory,
  ICategoryDictionary,
} from "../types/ICategoryDictionary";
import type { ICategoriesTree } from "../types/ITrees";
import createTreeDataObject from "../util/createTreeDataObject";

import type PromiseBB from "bluebird";
import * as React from "react";
import { FormControl } from "react-bootstrap";
import type * as SortableTreeT from "react-sortable-tree";
import type * as Redux from "redux";
import type { ThunkDispatch } from "redux-thunk";

import type {
  OnDragPreviousAndNextLocation,
  OnMovePreviousAndNextLocation,
  NodeData,
  FullTree,
} from "react-sortable-tree";
import SortableTree from "react-sortable-tree";
import { unknownToError } from "@vortex/shared";

const nop = () => undefined;

interface ISearchMatch {
  node: ICategoriesTree;
  path: string[];
  treeIndex: number;
}

interface INodeExtraArgs {
  categoryId: string;
  parentId: string;
  order: number;
}

interface IActionProps {
  onShowError: (
    message: string,
    details: string | Error,
    options: IErrorOptions,
  ) => void;
  onSetCategory: (
    gameId: string,
    categoryId: string,
    category: ICategory,
  ) => void;
  onRemoveCategory: (gameId: string, categoryId: string) => void;
  onSetCategoryOrder: (gameId: string, categoryIds: string[]) => void;
  onRenameCategory: (
    activeGameId: string,
    categoryId: string,
    newCategory: {},
  ) => void;
  onShowDialog: (
    type: DialogType,
    title: string,
    content: IDialogContent,
    actions: DialogActions,
  ) => PromiseBB<IDialogResult>;
}

interface IConnectedProps {
  gameMode: string;
  language: string;
  categories: ICategoryDictionary;
  mods: { [modId: string]: IMod };
}

interface IComponentState {
  treeData: ICategoriesTree[];
  expandedTreeData: ICategoriesTree[];
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
  declare public context: IComponentContext;
  private mButtons: IActionDefinition[];

  constructor(props) {
    super(props);
    this.initState({
      treeData: [],
      expandedTreeData: [],
      expanded: [],
      showEmpty: true,
      searchString: "",
      searchFocusIndex: 0,
      searchFoundCount: 0,
    });

    const { t } = props;

    this.mButtons = [
      {
        title: "Expand All",
        icon: "expand-all",
        action: this.expandAll,
      },
      {
        title: "Collapse All",
        icon: "collapse-all",
        action: this.collapseAll,
      },
      {
        title: "Add Root",
        icon: "folder-add",
        action: this.addRootCategory,
      },
      {
        title: "Show/Hide Empty",
        icon: "hide",
        action: this.toggleShowEmpty,
      },
      {
        title: "Sort Alphabetically",
        icon: "loot-sort",
        action: this.sortAlphabetically,
      },
    ];
  }

  public componentDidMount() {
    this.refreshTree(this.props);
  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
    if (this.props.categories !== newProps.categories) {
      this.refreshTree(newProps);
    }
  }

  public render(): JSX.Element {
    const { t } = this.props;
    const {
      expandedTreeData,
      searchString,
      searchFocusIndex,
      searchFoundCount,
    } = this.state;

    return (
      <div className="categories-dialog">
        <IconBar
          group="categories-icons"
          staticElements={this.mButtons}
          className="menubar categories-icons"
          t={t}
        />
        <div className="search-category-box">
          <div style={{ display: "inline-block", position: "relative" }}>
            <FormControl
              id="search-category-input"
              type="text"
              placeholder={t("Search")}
              value={searchString || ""}
              onChange={this.startSearch}
            />
            <Icon className="search-icon" name="search" />
            <span className="search-position">
              {t("{{ pos }} of {{ total }}", {
                replace: {
                  pos: searchFoundCount > 0 ? searchFocusIndex + 1 : 0,
                  total: searchFoundCount || 0,
                },
              })}
            </span>
          </div>
          <IconButton
            id="btn-search-category-prev"
            className="btn-embed"
            icon="search-up"
            tooltip={t("Prev")}
            type="button"
            disabled={!searchFoundCount}
            onClick={this.selectPrevMatch}
          />
          <IconButton
            id="btn-search-category-next"
            className="btn-embed"
            icon="search-down"
            tooltip={t("Next")}
            type="button"
            disabled={!searchFoundCount}
            onClick={this.selectNextMatch}
          />
        </div>
        <SortableTree
          treeData={expandedTreeData}
          onChange={nop}
          onVisibilityToggle={this.toggleVisibility}
          canDrop={this.canDrop}
          onMoveNode={this.moveNode}
          style={{ height: "95%" }}
          searchMethod={this.searchMethod}
          searchQuery={searchString}
          searchFocusOffset={searchFocusIndex}
          searchFinishCallback={this.searchFinishCallback}
          getNodeKey={this.getNodeKey}
          generateNodeProps={this.generateNodeProps}
        />
      </div>
    );
  }

  // tslint:disable-next-line:no-shadowed-variable
  private searchMethod = ({
    node,
    path,
    treeIndex,
    searchQuery,
  }: {
    node: ICategoriesTree;
    path: number[] | string[];
    treeIndex: number;
    searchQuery: any;
  }) => {
    return (
      searchQuery.length > 0 &&
      node.title.toLowerCase().indexOf(searchQuery.toLowerCase()) !== -1
    );
  };

  private updateExpandedTreeData = (categories: ICategoryDictionary) => {
    const { expanded, showEmpty, treeData } = this.nextState;
    this.nextState.expandedTreeData = this.applyExpand(
      treeData,
      showEmpty,
      new Set(expanded),
      categories,
    );
  };

  private getNonEmptyCategories(
    treeData: ICategoriesTree[],
    ancestry: string[],
  ): string[] {
    let res: string[] = [];
    treeData.forEach((category) => {
      if (category.modCount > 0) {
        res.push(category.categoryId);
        res = res.concat(ancestry);
      }
      res = res.concat(
        this.getNonEmptyCategories(
          category.children,
          [].concat(ancestry, [category.categoryId]),
        ),
      );
    });
    return res;
  }

  private applyExpand(
    treeData: ICategoriesTree[],
    showEmpty: boolean,
    expanded: Set<string>,
    categories: ICategoryDictionary,
  ): ICategoriesTree[] {
    const filtered: Set<string> = new Set(
      showEmpty
        ? Object.keys(categories)
        : this.getNonEmptyCategories(treeData, []),
    );

    return treeData
      .map((obj) => {
        if (!filtered.has(obj.categoryId)) {
          return undefined;
        }
        const copy: ICategoriesTree = { ...obj };
        copy.expanded = expanded.has(copy.categoryId);
        copy.children = this.applyExpand(
          copy.children,
          showEmpty,
          expanded,
          categories,
        );
        return copy;
      })
      .filter((obj) => obj !== undefined);
  }

  private toggleShowEmpty = () => {
    const { t, categories, mods, onShowError } = this.props;
    const { showEmpty } = this.state;

    try {
      const newTree = createTreeDataObject(t, categories, mods);
      this.nextState.treeData = newTree;
      this.nextState.showEmpty = !showEmpty;
      this.updateExpandedTreeData(categories);
    } catch (err) {
      onShowError(
        "An error occurred hiding/showing the empty categories",
        unknownToError(err),
        { allowReport: false },
      );
    }
  };

  private sortAlphabetically = () => {
    const { t, gameMode, categories, mods, onShowError, onSetCategoryOrder } =
      this.props;

    try {
      const newTree: ICategoriesTree[] = createTreeDataObject(
        t,
        categories,
        mods,
        (a, b) => categories[a].name.localeCompare(categories[b].name),
      );

      const newOrder = (base: ICategoriesTree[]): string[] => {
        return [].concat(
          ...base.map((node) => [node.categoryId, ...newOrder(node.children)]),
        );
      };

      onSetCategoryOrder(gameMode, newOrder(newTree));
    } catch (err) {
      onShowError("Failed to sort categories", unknownToError(err), {
        allowReport: false,
      });
    }
  };

  private expandAll = () => {
    const { categories } = this.props;
    this.nextState.expanded = Object.keys(categories);
    this.updateExpandedTreeData(categories);
  };

  private collapseAll = () => {
    this.nextState.expanded = [];
    this.updateExpandedTreeData(this.props.categories);
  };

  private renameCategory = (categoryId: string) => {
    const { categories, gameMode, onShowDialog, onRenameCategory } = this.props;

    const category = categories[categoryId];
    // one user seems to have managed to get this called on a category that (no longer?)
    // exists
    if (category === undefined) {
      return;
    }

    onShowDialog(
      "info",
      "Rename Category",
      {
        input: [{ id: "newCategory", value: category.name, label: "Category" }],
        condition: this.validateCategoryDialog,
      },
      [{ label: "Cancel" }, { label: "Rename" }],
    ).then((result: IDialogResult) => {
      if (result.action === "Rename") {
        onRenameCategory(gameMode, categoryId, result.input.newCategory);
      }
    });
  };

  private addCategory = (parentId: string) => {
    const { categories, gameMode, onSetCategory, onShowDialog } = this.props;
    const lastIndex = this.searchLastRootId(categories);

    if (Array.isArray(parentId)) {
      parentId = parentId[0];
    }

    onShowDialog(
      "question",
      "Add Child Category",
      {
        input: [
          { id: "newCategory", value: "", label: "Category Name" },
          {
            id: "newCategoryId",
            value: lastIndex.toString(),
            label: "Category ID",
          },
        ],
        condition: this.validateCategoryDialog,
      },
      [{ label: "Cancel" }, { label: "Add" }],
    ).then((result: IDialogResult) => {
      if (result.action === "Add") {
        onSetCategory(gameMode, result.input.newCategoryId, {
          name: result.input.newCategory,
          parentCategory: parentId,
          order: 0,
        });
      }
    });
  };

  private hasEmptyInput = (input: IInput): IConditionResult => {
    const { t } = this.props;
    return input.value === ""
      ? {
          id: input.id,
          actions: ["Add", "Rename"],
          errorText: t("{{label}} cannot be empty.", {
            replace: { label: input.label ? input.label : "Field" },
          }),
        }
      : undefined;
  };

  private idExists = (input: IInput): IConditionResult => {
    const { t, categories } = this.props;
    return categories[input.value] !== undefined
      ? { id: input.id, actions: ["Add"], errorText: t("ID already used.") }
      : undefined;
  };

  private validateCategoryDialog = (
    content: IDialogContent,
  ): IConditionResult[] => {
    const results: IConditionResult[] = [];
    content.input.forEach((inp) => {
      results.push(this.hasEmptyInput(inp));
      if (inp.id === "newCategoryId") {
        results.push(this.idExists(inp));
      }
    });

    return results.filter((res) => res !== undefined);
  };

  private addRootCategory = () => {
    const { categories, gameMode, onSetCategory, onShowDialog, onShowError } =
      this.props;
    const lastIndex = this.searchLastRootId(categories);

    onShowDialog(
      "question",
      "Add new Root Category",
      {
        input: [
          { id: "newCategory", value: "", label: "Category Name" },
          {
            id: "newCategoryId",
            value: lastIndex.toString(),
            label: "Category ID",
          },
        ],
        condition: this.validateCategoryDialog,
      },
      [{ label: "Cancel" }, { label: "Add", default: true }],
    ).then((result: IDialogResult) => {
      if (result.action === "Add") {
        onSetCategory(gameMode, result.input.newCategoryId, {
          name: result.input.newCategory,
          parentCategory: undefined,
          order: 0,
        });
      }
    });
  };

  private searchLastRootId(categories: ICategoryDictionary) {
    let maxId = 1000;
    if (categories !== undefined) {
      Object.keys(categories).filter((id: string) => {
        if (parseInt(id, 10) > maxId) {
          maxId = parseInt(id, 10);
        }
      });
    }
    return maxId + 1;
  }

  private selectPrevMatch = () => {
    const { searchFocusIndex, searchFoundCount } = this.state;

    this.nextState.searchFocusIndex =
      (searchFoundCount + searchFocusIndex - 1) % searchFoundCount;
  };

  private selectNextMatch = () => {
    const { searchFocusIndex, searchFoundCount } = this.state;

    this.nextState.searchFocusIndex = (searchFocusIndex + 1) % searchFoundCount;
  };

  private refreshTree(props: IProps) {
    const { t } = this.props;
    const { categories, mods } = props;

    if (categories !== undefined) {
      if (Object.keys(categories).length !== 0) {
        this.nextState.treeData = createTreeDataObject(t, categories, mods);
        this.updateExpandedTreeData(categories);
      }
    }
  }

  private startSearch = (event) => {
    this.nextState.searchString = event.target.value;
  };

  private searchFinishCallback = (matches: ISearchMatch[]) => {
    const { searchFocusIndex } = this.state;
    // important: Avoid updating the state if the values haven't changed because
    //  changing the state causes a re-render and a re-render causes the tree to search
    //  again (why?) which causes a new finish callback -> infinite loop
    if (this.state.searchFoundCount !== matches.length) {
      this.nextState.searchFoundCount = matches.length;
    }
    const newFocusIndex =
      matches.length > 0 ? searchFocusIndex % matches.length : 0;
    if (this.state.searchFocusIndex !== newFocusIndex) {
      this.nextState.searchFocusIndex = newFocusIndex;
    }
  };

  private removeCategory = (id: string) => {
    const { categories, gameMode, onRemoveCategory } = this.props;
    let userConfirmed = false;
    id = Array.isArray(id) ? id[0] : id;
    const catKeys = Object.keys(categories);
    const childrenIds = catKeys.filter(
      (key) => categories[key].parentCategory === id,
    );
    const removeCat = () => {
      childrenIds.forEach((iterId) => this.removeCategory(iterId));
      onRemoveCategory(gameMode, id);
    };
    if (userConfirmed) {
      removeCat();
    }
    if (childrenIds.length > 0) {
      this.context.api
        .showDialog(
          "question",
          "Remove Category",
          {
            text:
              "You're attempting to remove a category with one or more nested categories " +
              "Which may in turn, also contain their own sub-categories. Are you sure you wish to proceed ?",
          },
          [{ label: "Cancel", default: true }, { label: "Remove Category" }],
        )
        .then((res) => {
          if (res.action !== "Cancel") {
            userConfirmed = true;
            removeCat();
          }
        });
    } else {
      onRemoveCategory(gameMode, id);
    }
  };

  private generateNodeProps = (
    rowInfo: SortableTreeT.ExtendedNodeData<{ categoryId: string }>,
  ) => {
    const { t } = this.props;
    const actions: IActionDefinition[] = [
      {
        icon: "edit",
        title: "Rename",
        action: this.renameCategory,
      },
      {
        icon: "folder-add",
        title: "Add Child",
        action: this.addCategory,
      },
      {
        icon: "remove",
        title: "Remove",
        action: this.removeCategory,
      },
    ];
    return {
      buttons: [
        <ActionDropdown
          className="category-buttons"
          group="category-icons"
          staticElements={actions}
          t={t}
          instanceId={rowInfo.node.categoryId}
        />,
      ],
    };
  };

  private getNodeKey = (args: { node: ICategoriesTree; treeIndex: number }) => {
    return args.node.categoryId;
  };

  private toggleVisibility = (args: {
    treeData: ICategoriesTree[];
    node: ICategoriesTree;
    expanded: boolean;
  }) => {
    if (args.expanded) {
      this.nextState.expanded.push(args.node.categoryId);
    } else {
      this.nextState.expanded.splice(
        this.nextState.expanded.indexOf(args.node.categoryId),
      );
    }

    this.updateExpandedTreeData(this.props.categories);
  };

  private canDrop = (data: OnDragPreviousAndNextLocation & NodeData) => {
    const { nextPath, node } = data;
    return !(nextPath ?? []).slice(0, -1).includes(node["categoryId"]);
  };

  private moveNode = (
    data: NodeData & FullTree & OnMovePreviousAndNextLocation,
  ) => {
    const { gameMode, onSetCategory, onSetCategoryOrder } = this.props;
    const { path, node, treeData } = data;
    if (path[path.length - 2] !== node["parentId"]) {
      onSetCategory(gameMode, node["categoryId"], {
        name: node.title as string,
        order: node["order"],
        parentCategory: (path as string[])[path.length - 2],
      });
    } else {
      const newOrder = (base: ICategoriesTree[]): string[] => {
        return [].concat(
          ...base.map((node) => [node.categoryId, ...newOrder(node.children)]),
        );
      };
      onSetCategoryOrder(gameMode, newOrder(treeData as ICategoriesTree[]));
    }
  };
}

const emptyObj = {};

function mapStateToProps(state: IState): IConnectedProps {
  const gameMode = activeGameId(state);
  return {
    gameMode,
    language: state.settings.interface.language,
    categories: state.persistent.categories[gameMode] || emptyObj,
    mods: state.persistent.mods[gameMode],
  };
}

function mapDispatchToProps(
  dispatch: ThunkDispatch<IState, null, Redux.Action>,
): IActionProps {
  return {
    onRenameCategory: (
      gameId: string,
      categoryId: string,
      newCategory: string,
    ) => dispatch(renameCategory(gameId, categoryId, newCategory)),
    onSetCategory: (gameId: string, categoryId: string, category: ICategory) =>
      dispatch(setCategory(gameId, categoryId, category)),
    onRemoveCategory: (gameId: string, categoryId: string) =>
      dispatch(removeCategory(gameId, categoryId)),
    onSetCategoryOrder: (gameId: string, categoryIds: string[]) =>
      dispatch(setCategoryOrder(gameId, categoryIds)),
    onShowError: (
      message: string,
      details: string | Error,
      options: IErrorOptions,
    ) => showError(dispatch, message, details, options),
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
  };
}

export default translate(["common"])(
  connect(mapStateToProps, mapDispatchToProps)(CategoryList),
) as React.ComponentClass<{}>;
