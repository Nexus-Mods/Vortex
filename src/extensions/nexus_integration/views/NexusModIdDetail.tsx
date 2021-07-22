import FormInput from '../../../controls/FormInput';
import More from '../../../controls/More';
import { ValidationState } from '../../../types/ITableAttribute';
import { ComponentEx } from '../../../util/ComponentEx';
import { truthy } from '../../../util/util';

import { setDownloadModInfo } from '../../download_management/actions/state';
import { setModAttribute } from '../../mod_management/actions/mods';

import { guessFromFileName } from '../util/guessModID';

import { TFunction } from 'i18next';
import * as React from 'react';
import { useDispatch } from 'react-redux';
import * as Redux from 'redux';
import { Button, Icon, IconButton } from '../../../controls/TooltipControls';

function validateNum(value: string): ValidationState {
  return !truthy(value)
      || isNaN(Number(value))
      || (parseInt(value, 10) < 1)
      ? 'error' : 'success';
}

interface IInputProps {
  value: string;
  validate: ValidationState | ((value: any) => ValidationState);
  onChange?: (newValue: string) => void;
  placeholder: string;
}

function Input(props: IInputProps) {
  return (
    <FormInput
      groupClass='no-margin'
      placeholder={props.placeholder}
      value={props.value ?? ''}
      validate={props.validate}
      readOnly={props.onChange === undefined}
      debounceTimer={100}
      onChange={props.onChange}
    />
  );
}

export interface IProps {
  activeGameId: string;
  fileGameId: string;
  modId: string;
  readOnly?: boolean;
  isDownload: boolean;
  archiveId: string;
  fileHash: string;
  nexusFileId: string;
  nexusModId: string;
  fileName: string;
  t: TFunction;
  store: Redux.Store<any>;

  onOpenURL: () => void;
  onUpdateByMD5: () => void;
  onCheckForUpdate: () => void;
}

function saveModId(dispatch: Redux.Dispatch<any>, isDownload: boolean,
                   gameId: string, archiveId: string, modId: string, newNexusModId: string) {
  if (archiveId !== undefined) {
    dispatch(setDownloadModInfo(archiveId, 'nexus.ids.modId', parseInt(newNexusModId, 10)));
  }
  if (!isDownload) {
    dispatch(setModAttribute(gameId, modId, 'modId', parseInt(newNexusModId, 10)));
  }
}

function saveFileId(dispatch: Redux.Dispatch<any>, isDownload: boolean,
                    gameId: string, archiveId: string, modId: string, newNexusFileId: string) {
  const numId = !newNexusFileId ? undefined : parseInt(newNexusFileId, 10);
  if (archiveId !== undefined) {
    dispatch(setDownloadModInfo(archiveId, 'nexus.ids.fileId', numId));
  }
  if (!isDownload) {
    dispatch(setModAttribute(gameId, modId, 'fileId', numId));
  }
}

function NexusModIdDetail(props: IProps) {
  const { t, activeGameId, archiveId, fileHash, fileName, isDownload, modId,
          nexusFileId, nexusModId,
          onCheckForUpdate, onOpenURL, onUpdateByMD5 } = props;

  const [edit, setEdit] = React.useState(false);
  const [modIdTemp, setModId] = React.useState(nexusModId);
  const [fileIdTemp, setFileId] = React.useState(nexusFileId);
  const [fileMD5Temp, setFileMD5] = React.useState(fileHash);
  const dispatch = useDispatch();

  React.useEffect(() => { setFileMD5(fileHash); }, [fileHash]);
  React.useEffect(() => { setModId(nexusModId); }, [nexusModId]);
  React.useEffect(() => {
    setFileId(nexusFileId);
  }, [setFileId, nexusFileId]);

  const setFileIdWrap = React.useCallback((fileId: any) => {
    setFileId(fileId);
  }, [setFileId]);

  const changeEdit = React.useCallback((doEdit: boolean = true) => {
    setModId(nexusModId);
    setFileId(nexusFileId);
    setFileMD5(fileHash);
    setEdit(doEdit);
  }, [setEdit, setModId, setFileId, setFileMD5, nexusModId, nexusFileId, fileHash]);

  const startEdit = React.useCallback(() => {
    changeEdit(true);
  }, [changeEdit]);

  const cancel = React.useCallback(() => {
    changeEdit(false);
  }, [changeEdit]);

  const save = React.useCallback(() => {
    saveModId(dispatch, isDownload, activeGameId, archiveId, modId, modIdTemp);
    saveFileId(dispatch, isDownload, activeGameId, archiveId, modId, fileIdTemp);
  }, [saveModId, saveFileId, isDownload, activeGameId, modId, modIdTemp, fileIdTemp]);

  const guessModId = React.useCallback(() => {
    const guessed = guessFromFileName(fileName);
    if (guessed !== undefined) {
      if (isDownload) {
        dispatch(setDownloadModInfo(modId, 'nexus.ids.modId', guessed));
      } else {
        dispatch(setModAttribute(activeGameId, modId, 'modId', guessed));
      }
    }
  }, [dispatch, activeGameId, fileName, modId]);

  const fetchFileId = React.useCallback(() => {
    if (!!fileHash) {
      // have file hash
      onUpdateByMD5();
    } else {
      onCheckForUpdate();
    }
  }, [onUpdateByMD5, onCheckForUpdate, fileHash, modId]);

  const validNum = React.useCallback((value: string) => {
    return validateNum(value);
  }, []);

  if (edit) {
    const haveHash = !!fileHash;
    const hashValidation = !!fileMD5Temp ? 'success' : !!fileIdTemp ? null : 'error';
    return (
      <div className='modid-detail'>
        <table>
          <tbody>
            <tr>
              <th>
                {t('File Hash')}
                <More id='file-hash' name={t('File Hash (MD5)')}>
                  {t('A hash can be calculated from any mod archive on disk and we can '
                    + 'use it to look up all other information Nexus Mods has on a mod. '
                    + 'If the archive has been deleted before we saved the hash there is no '
                    + 'way to get at it.')}
                </More>
              </th>
              <td>
                <Input
                  value={fileMD5Temp}
                  validate={hashValidation}
                  placeholder={t('e.g. {{sample}}',
                                 { replace: { sample: '14758f1afd44c09b7992073ccf00b43d' }})}
                />
              </td>
              <td className='modid-detail-control'>
                {(archiveId !== undefined) && !haveHash ? (
                  <Button
                    disabled={!fileIdTemp}
                    onClick={onUpdateByMD5}
                    tooltip={t('Calculate hash (can take a moment)')}
                  >
                    {t('Fetch')}
                  </Button>
                ) : null}
              </td>
            </tr>
            <tr>
              <th>
                {t('Mod ID')}
                <More id='nexus-mod-id' name={t('Mod ID')}>
                  {t('The mod id identifies a mod page on nexus mods. It helps us find '
                     + 'the name, description, author, ... of a mod but with this id alone, '
                     + 'we don\'t know which file exactly (version, variant) this is.')}
                </More>
              </th>
              <td>
                <Input
                  value={modIdTemp ?? ''}
                  onChange={setModId}
                  validate={validNum}
                  placeholder={t('e.g. {{sample}}', { replace: { sample: '1337' }})}
                />
              </td>
              <td className='modid-detail-control'>
                {haveHash ? (
                  <Button
                    onClick={onUpdateByMD5}
                    tooltip={t('Look up by file hash')}
                  >
                    {t('Query Server')}
                  </Button>
                ) : (
                  <Button
                    onClick={guessModId}
                    tooltip={t('Guess the mod id based on the file name')}
                  >
                    {t('Guess')}
                  </Button>
                )}
              </td>
            </tr>
            <tr>
              <th>
                {t('File ID')}
                <More id='nexus-file' name={t('File ID')}>
                  {t('The file id identifies a specific file. We need this to check for '
                    + 'updates, to include mods in a collection and to correctly identify '
                    + 'if you try to install a second copy of the same file for example.')}
                </More>
              </th>
              <td>
                <Input
                  value={fileIdTemp ?? ''}
                  onChange={setFileIdWrap}
                  validate={validNum}
                  placeholder={t('e.g. {{sample}}', { replace: { sample: '1337' }})}
                />
              </td>
              <td className='modid-detail-control'>
                <Button
                  onClick={fetchFileId}
                  tooltip={haveHash
                    ? t('Look up')
                    : t('Look up. May fail if the mod has been hidden/archived by the author.')}
                >
                  {t('Query Server')}
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
        <Button onClick={cancel} tooltip={t('Close')}>{t('Close')}</Button>
        {' '}
        <Button onClick={save} tooltip={t('Save changes')}>{t('Apply')}</Button>
      </div>
    );
  } else {
    const valid: true | string = !nexusModId
      ? t('No mod id') as string
      : !nexusFileId
      ? t('No file id') as string
      : true;

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Icon
          className={(valid === true) ? 'nexus-id-valid' : 'nexus-id-invalid'}
          name={(valid === true) ? 'feedback-success' : 'feedback-warning'}
          tooltip={(valid === true) ? t('Mod identified') : t('Mod not identified correctly')}
        />
        <div>{valid === true ? `M: ${nexusModId}, F: ${nexusFileId}` : valid}</div>
        <IconButton icon='edit' tooltip={t('Edit')} onClick={startEdit} className='btn-embed' />
        <IconButton
          icon='open-in-browser'
          tooltip={t('Open on Nexus Mods')}
          onClick={onOpenURL}
          className='btn-embed'
        />
      </div>
    );
  }
}
export default NexusModIdDetail;
