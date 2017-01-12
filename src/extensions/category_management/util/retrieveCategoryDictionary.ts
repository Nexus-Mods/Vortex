interface ICategoryDic {
  [id: string]: { name: string, parentCategory: string };
};

function searchChildren(children: any, categoryList: any[], rootId: string) {
  let categoryDict: ICategoryDic;
  children.forEach(child => {
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

export function createCategoryDict(event: any) {
  let categoryList: any[] = [];
  let categoryDict: ICategoryDic;
  event.forEach(element => {
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

  let categories = categoryList.reduce((result, item) => {
    let key = Object.keys(item)[0];
    result[key] = item[key];
    return result;
  }, {});

  return categories;
}
