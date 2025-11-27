import { createAction } from 'redux-act';

export const setTutorialOpen = createAction('TOGGLE_TUTORIAL',
  (tutorialId: number, isOpen: boolean) => ({tutorialId, isOpen}));

export const closeTutorials = createAction('CLOSE_TUTORIALS');
