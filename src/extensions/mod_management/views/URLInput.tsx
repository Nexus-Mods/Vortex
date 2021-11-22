import * as React from 'react';
import { useDispatch } from 'react-redux';
import FlexLayout from '../../../controls/FlexLayout';
import FormInput from '../../../controls/FormInput';
import { IconButton } from '../../../controls/TooltipControls';
import { TFunction } from '../../../util/i18n';
import opn from '../../../util/opn';
import { setModAttribute } from '../actions/mods';
import { IMod } from '../types/IMod';

function isURLValid(url: string) {
  try {
    // tslint:disable-next-line:no-unused-expression
    new URL(url);
  } catch (e) {
    return false;
  }
  return true;
}

export interface IURLInputProps {
  t: TFunction;
  gameId: string;
  mod: IMod;
}

function URLInput(props: IURLInputProps) {
  const { t, gameId, mod } = props;

  const dispatch = useDispatch();

  const updateURL = React.useCallback((newUrl: string) => {
    dispatch(setModAttribute(gameId, mod.id, 'url', newUrl));
  }, [gameId, mod]);

  const openSite = React.useCallback(() => {
    opn(mod.attributes?.url).catch(() => null);
  }, [mod]);

  return (
    <FlexLayout type='row'>
      <FormInput style={{ flex: '1 1 0' }} value={mod.attributes?.url} onChange={updateURL} />
      <IconButton
        icon='open-in-browser'
        disabled={!isURLValid(mod.attributes?.url)}
        tooltip={t('Open website in your browser')}
        onClick={openSite}
      />
    </FlexLayout>
  );
}

export default URLInput;
