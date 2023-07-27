import i18next, { TFunction } from 'i18next';
import * as React from 'react';
import { Button } from 'react-bootstrap';

import FlexLayout from '../../../controls/FlexLayout';
import Icon from '../../../controls/Icon';
import { IComponentContext } from '../../../types/IComponentContext';
import opn from '../../../util/opn';
import { Campaign, nexusModsURL, Section, Source } from '../../../util/util';
import { MainContext } from '../../../views/MainWindow';
import { PREMIUM_PATH } from '../constants';

export interface IPremiumNagBanner {
  t: TFunction;
  onDownload: () => void;
  onCheckStatus: () => void;
  campaign: string | Campaign;
}

function PremiumNagBanner(props: IPremiumNagBanner) {
  const { t, campaign, onDownload, onCheckStatus } = props;

  const context = React.useContext<IComponentContext>(MainContext);

  const [disableRefresh, setDisableRefresh] = React.useState<boolean>(false);
  const [showRefresh, setShowRefresh] = React.useState<boolean>(false);

  const goGetPremium = React.useCallback(() => {
    context.api.events.emit('analytics-track-click-event', 'Go Premium', 'Download Mod');

    // show button in case user needs it to refresh status
    setShowRefresh(true);

    opn(nexusModsURL(PREMIUM_PATH, {
      section: Section.Users,
      campaign: Campaign.BuyPremium,
      source: Source.DownloadsNagAd
    })).catch(() => null);
  }, [campaign]);

  const checkStatus = React.useCallback(() => {

    // disable button
    setDisableRefresh(true);

    // enable again in 5 seconds
    setTimeout(() => setDisableRefresh(false), 5000);

    // go check status anyway (for now)
    onCheckStatus();
  }, []);

  return (
    <div className='nexus-premium-banner'>
      <FlexLayout type='row' className='nexus-premium-text'>
        <FlexLayout.Fixed>
          <Icon name='download-speed' />
        </FlexLayout.Fixed>
        <FlexLayout.Flex className=''>
          <span>{t('Fewer clicks and higher download speeds when you go ')}</span>
          <span className='nexus-premium-highlight'>Premium</span>
        </FlexLayout.Flex>
      </FlexLayout>

      <div className='flex-spread'>
        <div style={{gap: '4px', display: 'flex'}}>
          <Button bsStyle='ghost' onClick={goGetPremium}>{t('Go Premium & Download Fast')}</Button>
          {(showRefresh) ? (<Button onClick={checkStatus} disabled={disableRefresh}>{t('Refresh Premium Status')}</Button>) : null}
        </div>
        <Button onClick={onDownload}>{t('Download')}</Button>
      </div>
    </div>
  );
}

export default PremiumNagBanner;
