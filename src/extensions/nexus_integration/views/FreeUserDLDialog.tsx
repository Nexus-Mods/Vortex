import Nexus, { IModFile, IModFileQuery, IOAuthCredentials } from '@nexusmods/nexus-api';
import { TFunction } from 'i18next';
import * as React from 'react';
import { Button, Panel } from 'react-bootstrap';
import { useSelector } from 'react-redux';
import { util } from '../../..';
import FlexLayout from '../../../controls/FlexLayout';
import Image from '../../../controls/Image';
import Modal from '../../../controls/Modal';
import Spinner from '../../../controls/Spinner';
import { IconButton } from '../../../controls/TooltipControls';
import { IState } from '../../../types/IState';
import { log } from '../../../util/log';
import { FALLBACK_AVATAR, NEXUS_BASE_URL } from '../constants';
import NXMUrl from '../NXMUrl';
import { makeFileUID } from '../util/UIDs';
import PremiumNagBanner from './PremiumNagBanner';
import { IValidateKeyDataV2 } from '../types/IValidateKeyData';

interface IFreeUserDLDialogProps {
  t: TFunction;
  nexus: Nexus;
  onDownload: (url: string) => void;
  onSkip: (url: string) => void;
  onCancel: (url: string) => boolean;
  onUpdated: () => void;
  onRetry: (url: string) => void;
  onCheckStatus: () => void;
}

const FILE_QUERY: IModFileQuery = {
  modId: true,
  mod: {
    summary: true,
    name: true,
    pictureUrl: true,
    uploader: {
      name: true,
      avatar: true,
    },
  },
  game: {
    domainName: true,
  },
  name: true,
  owner: {
    memberId: true,
  } as any,
};

type RecursivePartial<T> = {
  [P in keyof T]?:
    T[P] extends Array<(infer U)> ? Array<RecursivePartial<U>> :
    T[P] extends object ? RecursivePartial<T[P]> :
    T[P];
};

const makeUnknown: (t: TFunction, url: NXMUrl) => RecursivePartial<IModFile> =
    (t: TFunction, url: NXMUrl) => {
      return {
        modId: undefined,
        mod: {
          summary: t('N/A'),
          name: t('Mod with id {{modId}}', { modId: url.modId }),
          pictureUrl: null,
          uploader: {
            name: t('N/A'),
            avatar: undefined,
          },
        },
        game: {
          domainName: undefined,
        },
        name: t('N/A'),
        owner: {
          member_id: undefined,
        } as any,
      };
};

function nop() {
  // nop
}

function FreeUserDLDialog(props: IFreeUserDLDialogProps) {

  const { t, nexus, onCancel, onDownload, onSkip, onUpdated, onRetry, onCheckStatus } = props;

  //return oauthCred !== undefined ? oauthCred.token : undefined;



  const urls: string[] = useSelector<IState, string[]>(state =>
    state.session['nexus'].freeUserDLQueue);

  const userInfo = useSelector<IState, IValidateKeyDataV2>(state =>
    state.persistent['nexus'].userInfo);

  // const [fileInfo, setFileInfo] = React.useState<Partial<IModFile>>(null);
  const [fileInfo, setFileInfo] = React.useState<any>(null);
  const [campaign, setCampaign] = React.useState<string>(undefined);
  const lastFetchUrl = React.useRef<string>();

  React.useEffect(() => {
    //log('info', '[FreeUserDLDialog] userInfo has changed', {userInfo:userInfo, urls: urls});
    // if userInfo is updated, and isPremium is true, then retry
    if(userInfo !== undefined) 
      if(userInfo?.isPremium && urls.length > 0)
        onRetry(urls[0]);
  }, [userInfo]);

  React.useEffect(() => {
    const fetchFileInfo = async () => {
      const url: NXMUrl = new NXMUrl(urls[0]);

      onUpdated();
      setFileInfo(null);
      setCampaign(url.getParam('campaign'));

      try {
        const fileInfoList = await nexus.modFilesByUid(
          FILE_QUERY,
          [makeFileUID({ fileId: url.fileId.toString(), gameId: url.gameId })]);
        if (fileInfoList.length > 0) {
          setFileInfo(fileInfoList[0]);
        } else {
          setFileInfo(makeUnknown(t, url));
        }
      } catch (err) {
        log('error', 'failed to fetch file information', { url, error: err.message });
        setFileInfo(makeUnknown(t, url));
      }
    };

    if ((urls.length > 0) && (urls[0] !== lastFetchUrl.current)) {
      lastFetchUrl.current = urls[0];
      fetchFileInfo();
    }
  }, [urls]);

  const checkStatus = React.useCallback(() => {
    onCheckStatus();
  }, [])

  const retry = React.useCallback(() => {
    onRetry(urls[0]);
  }, [onRetry, urls]);

  const cancel = React.useCallback(() => {
    onCancel(urls[0]);
  }, [onCancel, urls]);

  const download = React.useCallback(() => {
    onDownload(urls[0]);
  }, [onCancel, urls]);

  const skip = React.useCallback(() => {
    onSkip(urls[0]);
  }, [onSkip, urls]);

  const openModPage = React.useCallback(() => {
    util.opn(`${NEXUS_BASE_URL}/${fileInfo.game.domainName}/mods/${fileInfo.modId}`);
  }, [fileInfo]);

  const openAuthorPage = React.useCallback(() => {
    util.opn(`${NEXUS_BASE_URL}/${fileInfo.game.domainName}/users/${fileInfo.owner.memberId}`);
  }, [fileInfo]);

  return (
    <Modal show={urls.length > 0} onHide={nop}>
      <Modal.Header>
        <Modal.Title>
          {t('Download "{{modName}}"', { replace: {
            modName: fileInfo !== null ? fileInfo.name : '...',
          } })}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {t('You need to download {{modName}} from the Nexus Mods website. '
          + 'The link below will open the mod page.')}
        <Panel className='margin-top-hg'>
          <FlexLayout type='row' className='padding-hg'>
            <FlexLayout.Fixed>
              {(fileInfo !== null) ? (
                <Image className='free-user-dl-image' srcs={[fileInfo.mod.pictureUrl]} />
              ) : <Spinner />}
            </FlexLayout.Fixed>
            <FlexLayout.Flex>
              {(fileInfo !== null) ? (
                <FlexLayout type='column'>
                  <div className='free-user-dl-name'>
                    {fileInfo.mod.name}
                    {' '}
                    <IconButton
                      icon='open-in-browser'
                      className='btn-embed'
                      tooltip={t('Open mod page')}
                      onClick={openModPage}
                    />
                  </div>
                  <div className='free-user-dl-uploader'>
                    <Image
                      circle
                      srcs={[fileInfo.mod.uploader.avatar, FALLBACK_AVATAR]}
                    />
                    <a onClick={openAuthorPage}>{fileInfo.mod.uploader.name}</a>
                  </div>
                  <div className='free-user-dl-summary'>{fileInfo.mod.summary}</div>
                </FlexLayout>
              ) : null}
            </FlexLayout.Flex>
          </FlexLayout>
          <PremiumNagBanner t={t} onCheckStatus={checkStatus} onDownload={download} campaign={campaign} />
        </Panel>
      </Modal.Body>
      <Modal.Footer>

        <Button onClick={cancel}>{t('Cancel')}</Button>
        <Button onClick={skip}>{t('Skip')}</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default FreeUserDLDialog;
