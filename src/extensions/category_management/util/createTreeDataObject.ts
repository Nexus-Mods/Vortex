
import generateSubtitle from './generateSubtitle';

interface ICategory {
  categoryId: number;
  name: string;
  parentCategory: number | false;
}

interface IChildren {
  rootId: string;
  title: string;
  subtitle: string;
  expanded: boolean;
  parentId: string;
  children: IChildren[];
}

interface ICategoryTree {
  rootId: string;
  title: string;
  subtitle: string;
  expanded: boolean;
  children: IChildren[];
  parentId: string;
}

function searchChildren(categories: Object, rootId: string, mods: any) {
  let children = Object.keys(categories).filter((id: string) =>
    (rootId === categories[id].parentCategory));

  let childrenList = [];

  children.forEach((element) => {
    let child: IChildren = {
      rootId: element,
      title: categories[element].name,
      subtitle: mods !== undefined ? generateSubtitle(element, mods) : '',
      expanded: false,
      parentId: categories[element].parentCategory,
      children: searchChildren(categories, element, mods),
    };
    childrenList.push(child);
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

function createTreeDataObject(categories: Object, mods: any) {
  let categoryList = [];

  let roots = Object.keys(categories).filter((id: string) =>
    (categories[id].parentCategory === undefined));

  roots.forEach((rootElement) => {
    let children = Object.keys(categories).filter((id: string) =>
      (rootElement === categories[id].parentCategory));

    let childrenList = [];

    children.forEach((element) => {
      let child: IChildren = {
        rootId: element,
        title: categories[element].name,
        subtitle: mods !== undefined ? generateSubtitle(element, mods) : '',
        expanded: false,
        parentId: categories[element].parentCategory,
        children: searchChildren(categories, element, mods),
      };
      childrenList.push(child);
    });

    let root: ICategoryTree = {
      rootId: rootElement,
      title: categories[rootElement].name,
      subtitle: mods !== undefined ? generateSubtitle(rootElement, mods) : '',
      expanded: false,
      parentId: undefined,
      children: childrenList,
    };
    categoryList.push(root);
  });

  return categoryList;
}

export default createTreeDataObject;
