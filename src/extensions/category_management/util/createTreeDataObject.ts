import generateSubtitle from './generateSubtitle';

interface ICategory {
  categoryId: number;
  name: string;
  parentCategory: number | false;
  order: number;
}

interface IChildren {
  rootId: string;
  title: string;
  subtitle: string;
  expanded: boolean;
  parentId: string;
  children: IChildren[];
  order: number;
}

interface ICategoryTree {
  rootId: string;
  title: string;
  subtitle: string;
  expanded: boolean;
  children: IChildren[];
  parentId: string;
  order: number;
}

function searchChildren(categories: Object, rootId: string, mods: any, hidden: boolean) {
  let children = Object.keys(categories)
  .filter((id: string) => (rootId === categories[id].parentCategory))
  .sort((lhs, rhs) => (categories[lhs].order - categories[rhs].order));

  let childrenList = [];

  children.forEach((element) => {
    let subt: string = mods !== undefined ? generateSubtitle(element, mods) : '';
    let child: IChildren = {
      rootId: element,
      title: categories[element].name,
      subtitle: subt,
      expanded: false,
      parentId: categories[element].parentCategory,
      order: categories[element].order,
      children: searchChildren(categories, element, mods, hidden),
    };
    if (!hidden) {
      childrenList.push(child);
    } else if (subt !== '') {
      childrenList.push(child);
    }
  });

  return childrenList;
}

/**
 * create the treeDataObject from the categories inside the store
 * 
 * @param {Object} categories
 * @param {any} mods
 * @return {[]} categoryList
 * 
 */

function createTreeDataObject(
  categories: Object, mods: any,
  hidden: boolean) {
  let categoryList = [];

  let roots = Object.keys(categories)
  .filter((id: string) => (categories[id].parentCategory === undefined))
  .sort((lhs, rhs) => (categories[lhs].order - categories[rhs].order));

  roots.forEach((rootElement) => {
    let children = Object.keys(categories)
    .filter((id: string) => (rootElement === categories[id].parentCategory))
    .sort((lhs, rhs) => (categories[lhs].order - categories[rhs].order));

    let childrenList = [];

    children.forEach((element) => {
      let subt: string = mods !== undefined ? generateSubtitle(element, mods) : '';
      let child: IChildren = {
        rootId: element,
        title: categories[element].name,
        subtitle: subt,
        expanded: false,
        parentId: categories[element].parentCategory,
        order: categories[element].order,
        children: searchChildren(categories, element, mods, hidden),
      };
      if (!hidden) {
        childrenList.push(child);
      } else if (subt !== '') {
        childrenList.push(child);
      }
    });

    let root: ICategoryTree = {
      rootId: rootElement,
      title: categories[rootElement].name,
      subtitle: mods !== undefined ? generateSubtitle(rootElement, mods) : '',
      expanded: false,
      parentId: undefined,
      children: childrenList,
      order: categories[rootElement].order,
    };
    categoryList.push(root);
  });

  return categoryList;
}

export default createTreeDataObject;
