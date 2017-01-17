import { ICategoryDictionary } from '../types/IcategoryDictionary';
import { ITreeDataObject } from '../types/ITrees';

function searchChildren(children: any, categoryList: ICategoryDictionary[], rootId: string) {
  let categoryDict: ICategoryDictionary;
  children.forEach((child) => {
    categoryDict = {
      [child.rootId]:
      {
        name: child.title, parentCategory: rootId,
      },
    };
    categoryList.push(categoryDict);
    if (child.children !== undefined) {
      if (child.children.length !== 0) {
        searchChildren(child.children, categoryList, child.rootId);
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
  treeDataObject.forEach((element) => {
    categoryDict = {
      [element.rootId]:
      {
        name: element.title, parentCategory: undefined,
      },
    };

    categoryList.push(categoryDict);
    if (element.children !== undefined) {
      if (element.children.length !== 0) {
        categoryList = searchChildren(element.children, categoryList, element.rootId);
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
