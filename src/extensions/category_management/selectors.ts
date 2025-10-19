import { activeGameId } from '../profile_management/activeGameId';

export function allCategories(state: any) {
  const gameMode = activeGameId(state);
  const categories = state.persistent.categories[gameMode];
  return categories !== undefined ? categories : [];
}
