interface ICategory {
  categoryId: number;
  name: string;
  parentCategory: number | false;
}

interface IChildren {
  rootId: string;
  title: string;
  expanded: boolean;
  parentId: string;
  children: IChildren[];
}

interface ICategoryTree {
  rootId: string;
  title: string;
  expanded: boolean;
  children: IChildren[];
  parentId: string;
}

interface ICategoryDic {
  [id: string]: { name: string, parentCategory: number | false };
};

function searchChildren(categories: Object, rootId: string) {
  let children: any[] = Object.keys(categories).filter((id: string) =>
    (rootId === categories[id].parentCategory));

  let childrenList = [];

  children.forEach(element => {
    let child: IChildren = {
      rootId: element,
      title: categories[element].name,
      expanded: false,
      parentId: categories[element].parentCategory,
      children: searchChildren(categories, element),
    };
    childrenList.push(child);
  });

  return childrenList;
}

export function createTreeDataObject(categories: Object) {
  let categoryList = [];

  let roots: any[] = Object.keys(categories).filter((id: string) =>
    (categories[id].parentCategory === undefined));

  roots.forEach(rootElement => {
    let children: any[] = Object.keys(categories).filter((id: string) =>
      (rootElement === categories[id].parentCategory));

    let childrenList = [];

    children.forEach(element => {
      let child: IChildren = {
        rootId: element,
        title: categories[element].name,
        expanded: false,
        parentId: categories[element].parentCategory,
        children: searchChildren(categories, element),
      };
      childrenList.push(child);
    });

    let root: ICategoryTree = {
      rootId: rootElement,
      title: categories[rootElement].name,
      expanded: false,
      parentId: undefined,
      children: childrenList,
    };
    categoryList.push(root);
  });

  return categoryList;
}
