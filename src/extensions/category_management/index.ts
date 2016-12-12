import CategoryList from './views/CategoryList';

import { IExtensionContext } from '../../types/IExtensionContext';
import { setStateCategory } from './actions/session';

import { CATEGORIES } from './categories_sample';

import { ICategory } from './types/ICategory';

import { sessionReducer } from './reducers/session';

import { IStateCategory } from '../types/IStateCategory';

interface IChildren {
  title: string;
  expanded: boolean;
}

function init(context: IExtensionContext): boolean {
  context.registerMainPage('book', 'Categories', CategoryList, {
    hotkey: 'C',
  });

  context.registerReducer(['session', 'categories'], sessionReducer);

  context.once(() => {
    // const store: Redux.Store<any> = context.api.store;

    let categories = [];

    let roots = CATEGORIES.categories.filter((value) => value.parent_category === false);
    roots.forEach(rootElement => {
      let children: ICategory[] = CATEGORIES.categories.filter((value) =>
        value.parent_category === rootElement.category_id);
      let childrenList = [];

      children.forEach(element => {
        let child: IChildren = { title: element.name, expanded: false };
        childrenList.push(child);
      });

      let root: IStateCategory = {
        title: rootElement.name,
        expanded: false,
        children: childrenList,
      };
      categories.push(root);
    });

    context.api.store.dispatch(setStateCategory(categories));
  });

  return true;
}

export default init;
