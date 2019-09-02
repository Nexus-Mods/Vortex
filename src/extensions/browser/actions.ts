import safeCreateAction from '../../actions/safeCreateAction';

import { Action } from 'redux';
import { ThunkAction } from 'redux-thunk';

type ShowUrlFunc = (url: string, instructions?: string, subscriber?: string)
                   => Action<{ url: string, instructions: string, subscriber: string }>;

export const showURL: ShowUrlFunc =
  safeCreateAction('SHOW_URL',
    (url: string, instructions?: string, subscriber?: string) =>
      ({ url, instructions, subscriber })) as any;

export const closeBrowser = safeCreateAction('CLOSE_BROWSER');
