import { ICategoryDictionary } from '../types/IcategoryDictionary';
import { ITreeDataObject } from '../types/ITrees';

function searchChildren(
 children: any, categoryList: ICategoryDictionary[],
 rootId: string, counter: number) {
  let categoryDict: ICategoryDictionary;
  children.forEach((child) => {
    categoryDict = {
      [child.rootId]:
      {
        name: child.title, parentCategory: rootId, order: counter,
      },
    };
    categoryList.push(categoryDict);
    counter++;
    if (child.children !== undefined) {
      if (child.children.length !== 0) {
        searchChildren(child.children, categoryList, child.rootId, counter);
      }
    }
  });

  return categoryList;
}

/**
 * create the categories Dictionary from the treeDataObject
 * 
 * @param {ITreeDataObject[]} treeDataObject
 * @return {ICategoryDictionary} categories
 * 
 */

function createCategoryDictionary(treeDataObject: ITreeDataObject[]) {
  let categoryList: ICategoryDictionary[] = [];
  let categoryDict: ICategoryDictionary;
  let counter: number = 1;
  treeDataObject.forEach((element) => {
    categoryDict = {
      [element.rootId]:
      {
        name: element.title, parentCategory: undefined, order: counter,
      },
    };

    categoryList.push(categoryDict);
    counter++;
    if (element.children !== undefined) {
      if (element.children.length !== 0) {
        categoryList = searchChildren(element.children, categoryList, element.rootId, counter);
      }
    }
  });

  let categories: ICategoryDictionary = categoryList.reduce((result, item) => {
    let key = Object.keys(item)[0];
    result[key] = item[key];
    return result;
  }, {});

  return categories;
}

export default createCategoryDictionary;
