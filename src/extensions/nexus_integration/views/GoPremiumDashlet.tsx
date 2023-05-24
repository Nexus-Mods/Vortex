import Dashlet from '../../../controls/Dashlet';
import { ComponentEx, translate } from '../../../util/ComponentEx';
import opn from '../../../util/opn';

import { PREMIUM_PATH } from '../constants';

import * as React from 'react';
import { Button } from 'react-bootstrap';
import { WithTranslation } from 'react-i18next';
import { Campaign, nexusModsURL, Section, Source } from '../../../util/util';

class GoPremiumDashlet extends ComponentEx<WithTranslation, {}> {
  public render(): JSX.Element {
    const { t } = this.props;
    return (
      <Dashlet title='' className='dashlet-go-premium nexus-main-banner'>
        <div className='gopremium-widget-text'>{t('Go Premium')}</div>
        <div className='gopremium-widget-text'>{t('Uncapped downloads, no adverts')}</div>
        <div className='gopremium-widget-text'>{t('Support Nexus Mods')}</div>
        <div className='right-center'>
          <Button bsStyle='ad' onClick={this.goBuyPremium}>{t('Go Premium')}</Button>
        </div>
        <div className='nexus-ad-image' />
      </Dashlet>
    );
  }

  private goBuyPremium = () => {
    this.context.api.events.emit('analytics-track-click-event', 'Go Premium', 'Dashlet');
    opn(nexusModsURL(PREMIUM_PATH, {
      section: Section.Users,
      campaign: Campaign.BuyPremium,
      source: Source.DashboardAd
     }))
      .catch(err => undefined);
  }
}

export default translate(['common'])(GoPremiumDashlet);
