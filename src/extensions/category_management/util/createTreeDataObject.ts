import { getSafe, pushSafe } from '../../../util/storeHelper';

import { IMod } from '../../mod_management/types/IMod';
import { ICategory } from '../types/ICategoryDictionary';
import { ICategoriesTree } from '../types/ITrees';
import generateSubtitle from './generateSubtitle';

import { TFunction } from 'i18next';

function searchChildren(t: TFunction,
                        categories: { [categoryId: string]: ICategory },
                        rootId: string,
                        mods: { [categoryId: string]: IMod[] }) {
  const children = Object.keys(categories)
  .filter(id => rootId === categories[id].parentCategory)
  .sort((lhs: string, rhs: string) => (categories[lhs].order - categories[rhs].order));

  const childrenList = [];

  children.forEach(childId => {
    const nestedChildren: ICategoriesTree[] = searchChildren(t, categories, childId, mods);
    // tslint:disable-next-line:no-shadowed-variable
    const nestedModCount = nestedChildren.reduce((total: number, child: ICategoriesTree) =>
      total + child.modCount, 0);
    const modCount = getSafe(mods, [childId], []).length;
    const subt: string = (mods !== undefined)
      ? generateSubtitle(t, childId, mods, nestedModCount) : '';
    const child: ICategoriesTree = {
      categoryId: childId,
      title: categories[childId].name,
      subtitle: subt,
      expanded: false,
      modCount,
      parentId: categories[childId].parentCategory,
      order: categories[childId].order,
      children: nestedChildren,
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

function createTreeDataObject(t: TFunction,
                              categories: { [categoryId: string]: ICategory },
                              mods: {[modId: string]: IMod},
                              customSort?: (lhs: string, rhs: string) => number): ICategoriesTree[] {
  const categoryList: ICategoriesTree[] = [];

  const modsByCategory = Object.keys(mods || {}).reduce(
      (prev: {[categoryId: string]: IMod[]}, current: string) => {
        const category = getSafe(mods, [current, 'attributes', 'category'], undefined);
        if (category === undefined) {
          return prev;
        }
        return pushSafe(prev, [ category ], current);
      },
      {});

  const sortFunc = (lhs, rhs) => (customSort !== undefined)
      ? customSort(lhs, rhs)
      : (categories[lhs].order - categories[rhs].order);

  const roots = Object.keys(categories)
    .filter((id: string) => (categories[id].parentCategory === undefined))
    .sort((lhs, rhs) => sortFunc(lhs, rhs));

  roots.forEach(rootElement => {
    let childCategoryModCount = 0;
    const children = Object.keys(categories)
      .filter((id: string) => (rootElement === categories[id].parentCategory))
      .sort((lhs, rhs) => sortFunc(lhs, rhs));

    const childrenList = [];

    children.forEach(element => {
      const nestedChildren = searchChildren(t, categories, element, modsByCategory);
      // tslint:disable-next-line:no-shadowed-variable
      const nestedModCount = nestedChildren.reduce((total: number, child: ICategoriesTree) =>
        total + child.modCount, 0);

      const subtitle: string = generateSubtitle(t, element, modsByCategory, nestedModCount);
      const modCount = getSafe(modsByCategory, [element], []).length;
      childCategoryModCount += modCount;
      const child: ICategoriesTree = {
        categoryId: element,
        title: categories[element].name,
        subtitle,
        expanded: false,
        modCount,
        parentId: categories[element].parentCategory,
        order: categories[element].order,
        children: nestedChildren,
      };
      childrenList.push(child);
    });

    categoryList.push({
      categoryId: rootElement,
      title: categories[rootElement].name,
      subtitle: generateSubtitle(t, rootElement, modsByCategory, childCategoryModCount),
      expanded: false,
      parentId: undefined,
      modCount: getSafe(modsByCategory, [rootElement], []).length,
      children: childrenList,
      order: categories[rootElement].order,
    });
  });

  return categoryList;
}

export default createTreeDataObject;
