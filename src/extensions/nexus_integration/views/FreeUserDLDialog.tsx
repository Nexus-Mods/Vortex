import Nexus, { IModFile, IModFileQuery, IOAuthCredentials } from '@nexusmods/nexus-api';
import { TFunction } from 'i18next';
import * as React from 'react';
import { Button, Panel } from 'react-bootstrap';
import { useSelector } from 'react-redux';
import { util } from '../../..';
import Modal from '../../../controls/Modal';
import { IState } from '../../../types/IState';
import { log } from '../../../util/log';
import { NEXUS_BASE_URL, PREMIUM_PATH } from '../constants';
import NXMUrl from '../NXMUrl';
import { makeFileUID } from '../util/UIDs';
import { IValidateKeyDataV2 } from '../types/IValidateKeyData';
import NewFreeDownloadModal from './NewFreeDownloadModal';
import { MainContext } from '../../../views/MainWindow';
import { IComponentContext } from '../../../types/IComponentContext';
import opn from '../../../util/opn';
import { Campaign, Content, nexusModsURL, Section } from '../../../util/util';

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

  const urls: string[] = useSelector<IState, string[]>(state =>
    state.session['nexus'].freeUserDLQueue);

  const userInfo = useSelector<IState, IValidateKeyDataV2>(state =>
    state.persistent['nexus'].userInfo);

  const context = React.useContext<IComponentContext>(MainContext);

  const [fileInfo, setFileInfo] = React.useState<any>(null);
  const [campaign, setCampaign] = React.useState<string>(undefined);
  const lastFetchUrl = React.useRef<string>();

  const show = urls.length > 0 && !userInfo?.isPremium;

  React.useEffect(() => {
    if (!show) return;

    const handleFocus = () => {
      console.log('Window gained focus. Modal is open');
      checkStatus();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [show]);


  React.useEffect(() => {
    // if userInfo is updated, and isPremium is true, then retry
    if (userInfo !== undefined)
      if (userInfo?.isPremium && urls.length > 0)
        retry();
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
  }, [onCheckStatus]);

  const retry = React.useCallback(() => {
    onRetry(urls[0]);
  }, [onRetry, urls]);

  const cancel = React.useCallback(() => {
    onCancel(urls[0]);
  }, [onCancel, urls]);

  const download = React.useCallback(() => {
    onDownload(urls[0]);
  }, [onDownload, urls]);

  const skip = React.useCallback(() => {
    onSkip(urls[0]);
  }, [onSkip, urls]);

  const openModPage = React.useCallback(() => {
    util.opn(`${NEXUS_BASE_URL}/${fileInfo.game.domainName}/mods/${fileInfo.modId}`);
  }, [fileInfo]);

  const openAuthorPage = React.useCallback(() => {
    util.opn(`${NEXUS_BASE_URL}/${fileInfo.game.domainName}/users/${fileInfo.owner.memberId}`);
  }, [fileInfo]);

  const goPremium = React.useCallback(() => {
    context.api.events.emit('analytics-track-click-event', 'Go Premium', 'Download Mod');

    opn(nexusModsURL(PREMIUM_PATH, {
      section: Section.Users,
      campaign: Campaign.BuyPremium,
      content: Content.DownloadModModal
    })).catch(() => null);
  }, [campaign]);

  return (
    <Modal show={show} onHide={nop} id='free-user-dl-dialog'>
      <Modal.Header>
        <Modal.Title>
          {t('Download mod')}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <NewFreeDownloadModal 
          fileInfo={fileInfo} 
          t={t} 
          openModPage={openModPage} 
          goPremium={goPremium} 
          onDownload={download} />
      </Modal.Body>
      <Modal.Footer>
        <Button id='cancel-button' onClick={cancel}>{t('Cancel install')}</Button>
        <Button id='skip-button' onClick={skip}>{t('Skip mod')}</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default FreeUserDLDialog;
