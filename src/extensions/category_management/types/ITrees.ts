export interface IToggleExpandedTree {
  treeData: {};
  expanded: boolean;
}

export interface IRenamedTree {
  treeData: {};
  path: string[];
  newNode: {};
  getNodeKey: Function;
  ignoreCollapsed: boolean;
}

export interface IAddedTree {
  treeData: {};
  newNode: {};
  parentKey: number | string;
  getNodeKey: Function;
  ignoreCollapsed: boolean;
  expandParent: boolean;
}

export interface IRemovedTree {
  treeData: {};
  path: any;
  getNodeKey: Function;
  ignoreCollapsed: boolean;
}

export interface IFindTree {
  getNodeKey: Function;
  treeData: {};
  searchQuery: string | number;
  searchMethod: Function;
  searchFocusOffset: number;
  expandAllMatchPaths: boolean;
  expandFocusMatchPaths: boolean;
}

export interface IGetNodeTree {
  treeData: {};
  path: number[]|string[];
  getNodeKey: Function;
  ignoreCollapsed: boolean;
}

