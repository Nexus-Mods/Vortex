export function allCategories(state: any) {
  const gameMode = state.settings.gameMode.current;
  const categories = state.persistent.categories[gameMode];
  return categories !== undefined ? categories : [];
}
