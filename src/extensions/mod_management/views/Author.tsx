import { Button, IconButton } from '../../../controls/TooltipControls';
import { TFunction } from '../../../util/i18n';
import { truthy } from '../../../util/util';
import { setModAttributes } from '../actions/mods';
import { IModWithState } from '../types/IModProps';

import * as React from 'react';
import { FormControl } from 'react-bootstrap';
import { useDispatch } from 'react-redux';

function Input(props: { value: string, onChange: (newValue: string) => void }) {
  const onChange = React.useCallback((evt: React.FormEvent<any>) => {
    props.onChange(evt.currentTarget.value);
  }, [props.onChange]);
  return (
    <FormControl
      type='text'
      value={props.value ?? ''}
      onChange={onChange}
    />
  );
}

function Author(props: { t: TFunction, gameId: string, mod: IModWithState }) {
  const { t, gameId, mod } = props;
  const [edit, setEdit] = React.useState(false);
  const [authorTemp, setAuthor] = React.useState(mod.attributes?.author);
  const [uploaderTemp, setUploader] = React.useState(mod.attributes?.uploader);
  const [urlTemp, setURL] = React.useState(mod.attributes?.uploader_url);
  const dispatch = useDispatch();

  const changeEdit = React.useCallback((doEdit: boolean = true) => {
    setAuthor(mod.attributes?.author);
    setUploader(mod.attributes?.uploader);
    setURL(mod.attributes?.uploader_url);
    setEdit(doEdit);
  }, [setEdit, mod, setAuthor, setUploader, setURL]);

  const startEdit = React.useCallback(() => {
    changeEdit(true);
  }, [changeEdit]);

  const cancel = React.useCallback(() => {
    changeEdit(false);
  }, [changeEdit]);

  const save = React.useCallback(() => {
    dispatch(setModAttributes(gameId, mod.id, {
      author: authorTemp,
      uploader: uploaderTemp,
      uploader_url: urlTemp,
    }));
    changeEdit(false);
  }, [mod, dispatch, authorTemp, uploaderTemp, urlTemp, changeEdit]);

  if (edit) {
    return (
      <div>
        <table>
          <tbody>
            <tr>
              <td>{t('Author')}</td><td><Input value={authorTemp} onChange={setAuthor} /></td>
            </tr>
            <tr>
              <td>{t('Uploader')}</td><td><Input value={uploaderTemp} onChange={setUploader} /></td>
            </tr>
            <tr>
              <td>{t('Uploader URL')}</td><td><Input value={urlTemp} onChange={setURL} /></td>
            </tr>
          </tbody>
        </table>
        <Button onClick={cancel} tooltip={t('Cancel')}>{t('Cancel')}</Button>
        {' '}
        <Button onClick={save} tooltip={t('Save')}>{t('Save')}</Button>
      </div>
    );
  } else {
    const authors = [];
    if (truthy(mod.attributes?.author)) {
      authors.push(mod.attributes.author);
    }
    if (truthy(mod.attributes?.uploader)
        && (mod.attributes?.uploader !== mod.attributes?.author)) {
      authors.push(mod.attributes.uploader);
    }

    const authorP = (mod.attributes?.uploader_url !== undefined)
      ? <a href={mod.attributes?.uploader_url}>{authors.join(' & ')}</a>
      : <p>{authors.join(' & ')}</p>;

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {authorP}
        {' '}
        {
        (mod.state === 'installed')
          ? (
            <IconButton icon='edit' tooltip={t('Edit')} onClick={startEdit} className='btn-embed' />
            )
          : null
        }
      </div>
    );
  }
}

export default Author;
