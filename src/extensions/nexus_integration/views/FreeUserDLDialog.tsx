import Nexus, { IModFile, IModFileQuery } from '@nexusmods/nexus-api';
import { TFunction } from 'i18next';
import * as React from 'react';
import { Button, Panel } from 'react-bootstrap';
import { useSelector } from 'react-redux';
import FlexLayout from '../../../controls/FlexLayout';
import Image from '../../../controls/Image';
import Modal from '../../../controls/Modal';
import Spinner from '../../../controls/Spinner';
import { IState } from '../../../types/IState';
import { log } from '../../../util/log';
import { FALLBACK_AVATAR } from '../constants';
import NXMUrl from '../NXMUrl';
import { makeFileUID } from '../util/UIDs';
import PremiumNagBanner from './PremiumNagBanner';

interface IFreeUserDLDialogProps {
  t: TFunction;
  nexus: Nexus;
  onDownload: (url: string) => void;
  onSkip: (url: string) => void;
  onCancel: (url: string) => void;
  onUpdated: () => void;
}

const FILE_QUERY: IModFileQuery = {
  mod: {
    summary: true,
    name: true,
    pictureUrl: true,
    uploader: {
      name: true,
      avatar: true,
    },
  },
  name: true,
};

const makeUnknown: (t: TFunction, url: NXMUrl) => Partial<IModFile> =
    (t: TFunction, url: NXMUrl) => {
  return {
    mod: {
      author: t('N/A'),
      summary: t('N/A'),
      name: t('Mod with id {{modId}}', { modId: url.modId }),
      pictureUrl: null,
    },
  } as any;
};

function nop() {
  // nop
}

function FreeUserDLDialog(props: IFreeUserDLDialogProps) {
  const { t, nexus, onCancel, onDownload, onSkip, onUpdated } = props;

  const urls: string[] = useSelector<IState, string[]>(state =>
    state.session['nexus'].freeUserDLQueue);

  const [fileInfo, setFileInfo] = React.useState<Partial<IModFile>>(null);
  const [campaign, setCampaign] = React.useState<string>(undefined);
  const lastFetchUrl = React.useRef<string>();

  React.useEffect(() => {
    const fetchFileInfo = async () => {
      const url: NXMUrl = new NXMUrl(urls[0]);

      onUpdated();
      setFileInfo(null);
      setCampaign(url.getParam('campaign'));

      try {
        const fileInfoList = await nexus.modFilesByUid(FILE_QUERY,
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

  const cancel = React.useCallback(() => {
    onCancel(urls[0]);
  }, [onCancel, urls]);

  const download = React.useCallback(() => {
    onDownload(urls[0]);
  }, [onCancel, urls]);

  const skip = React.useCallback(() => {
    onSkip(urls[0]);
  }, [onSkip, urls]);

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
                  <div className='free-user-dl-name'>{fileInfo.mod.name}</div>
                  <div className='free-user-dl-uploader'>
                    <Image srcs={[fileInfo.mod.uploader.avatar, FALLBACK_AVATAR]} />
                    {fileInfo.mod.uploader.name}
                  </div>
                  <div className='free-user-dl-summary'>{fileInfo.mod.summary}</div>
                </FlexLayout>
                ) : null}
            </FlexLayout.Flex>
          </FlexLayout>
          <PremiumNagBanner t={t} onDownload={download} campaign={campaign} />
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
