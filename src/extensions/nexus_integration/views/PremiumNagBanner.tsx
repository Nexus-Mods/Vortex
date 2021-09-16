import i18next, { TFunction } from 'i18next';
import * as React from 'react';
import { Button } from 'react-bootstrap';

import FlexLayout from '../../../controls/FlexLayout';
import Icon from '../../../controls/Icon';
import opn from '../../../util/opn';
import { Campaign, nexusModsURL, Section } from '../../../util/util';
import { PREMIUM_PATH } from '../constants';

export interface IPremiumNagBanner {
  t: TFunction;
  onDownload: () => void;
  campaign: string | Campaign;
}

function PremiumNagBanner(props: IPremiumNagBanner) {
  const { t, campaign, onDownload } = props;

  const goGetPremium = React.useCallback(() => {
    opn(nexusModsURL(PREMIUM_PATH, {
      section: Section.Users,
      campaign,
    })).catch(() => null);
  }, [campaign]);

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
        <Button bsStyle='ghost' onClick={goGetPremium}>{t('Go Premium & Download Fast')}</Button>
        <Button onClick={onDownload}>{t('Download')}</Button>
      </div>
    </div>
  );
}

export default PremiumNagBanner;
