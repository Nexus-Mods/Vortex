import safeCreateAction from '../../actions/safeCreateAction';

import { Action } from 'redux';
import { ThunkAction } from 'redux-thunk';

type ShowUrlFunc = (url: string, instructions?: string, subscriber?: string, skippable?: boolean)
  => Action<{ url: string, instructions: string, subscriber: string, skippable: boolean }>;

export const showURL: ShowUrlFunc =
  safeCreateAction('SHOW_URL',
    (url: string, instructions?: string, subscriber?: string, skippable?: boolean) =>
      ({ url, instructions, subscriber, skippable: skippable ?? false })) as any;

export const closeBrowser = safeCreateAction('CLOSE_BROWSER');
