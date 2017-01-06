import { IFindTree, IGetNodeTree } from '../types/ITrees';

import { getSafe } from '../../../util/storeHelper';

function convertGameId(input: string): string {
  if (input === 'skyrimse') {
    return 'skyrimspecialedition';
  } else {
    return input;
  }
}

export function retrieveCategoryPath(
  category: number,
  store: any,
  categoryPath: string,
  isDetail: boolean) {

  let gameId: string = convertGameId(getSafe(store.getState(),
    ['settings', 'gameMode', 'current'], ''));

  let categories: any = getSafe(store.getState(), ['persistent', 'categories', gameId], '');

  let treeFunctions = require('react-sortable-tree');
  let completePath: string = '';
  try {
    let newTree: IFindTree = {
      getNodeKey: treeFunctions.defaultGetNodeKey,
      treeData: categories.gameCategories,
      searchQuery: category,
      searchMethod: ({ node, searchQuery }) => (node.rootId === searchQuery),
      searchFocusOffset: 0,
      expandAllMatchPaths: false,
      expandFocusMatchPaths: true,
    };

    let result = treeFunctions.find(newTree);
    if (isDetail !== true) {
      return result.matches[0].node.title;
    }

    let pathList: string[] = [];

    result.matches[0].path.forEach(element => {
      pathList.push(element);
      let getNodeTree: IGetNodeTree = {
        treeData: categories.gameCategories,
        path: pathList,
        getNodeKey: treeFunctions.defaultGetNodeKey,
        ignoreCollapsed: true,
      };
      let tree = treeFunctions.getNodeAtPath(getNodeTree);
      if (completePath === '') {
        completePath = tree.node.title;
      } else {
        completePath = completePath + ' --> ' + tree.node.title;
      }
    });

  } catch (err) {
    return null;
  }

  return completePath;
}
