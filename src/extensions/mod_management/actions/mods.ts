import { IMod, ModState } from '../types/IMod';

import { createAction } from 'redux-act';

export const addMod = createAction('add a mod',
  (mod: IMod) => mod);

export const setModState = createAction('set state of a mod',
  (id: string, modState: ModState) => { return { id, modState }; });

export const setModAttribute = createAction('set an attribute on a mod',
  (id: string, attribute: string, value: any) => { return { id, attribute, value }; });

export const setAttributeEnabled = createAction('show/hide an attribute in the mod list',
  (id: string, enabled: boolean) => { return { id, enabled }; } );
