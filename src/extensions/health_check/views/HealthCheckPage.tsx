import * as React from 'react';
import { useTranslation } from 'react-i18next';

import MainPage from '../../../views/MainPage';
import { Typography } from '../../../tailwind/components/next/typography';
import { Icon } from '../../../tailwind/components/next/icon';
import { Button } from '../../../tailwind/components/next/button';

function HealthCheckPage() {
  const { t } = useTranslation(['health_check', 'common']);

  return (
    <MainPage id='health-check-page'>
      <MainPage.Body>
        <div className="tw:flex tw:w-full tw:max-w-5xl tw:p-6 tw:flex-col tw:justify-start tw:items-center tw:gap-4">

          <div className="tw:flex tw:self-stretch tw:flex-col tw:justify-center tw:items-start">
            <Typography as="div" typographyType='heading-sm' appearance='strong' className='tw:m-0'>{t('health_check:title')}</Typography>
            <Typography as="p" typographyType='body-md' appearance='strong'>{t('health_check:description')}</Typography>
          </div>

          {/* Auto-fix dependencies card for Premium users */}
          <div className="tw:flex tw:self-stretch tw:px-4 tw:py-3 tw:bg-linear-to-r tw:from-[#322551] tw:via-[#262035] tw:to-[#322551] tw:rounded-sm tw:shadow-lg tw:border-t tw:border-b tw:border-premium-600/23 tw:justify-start tw:items-center tw:gap-3">
            <div className="tw:py-1 tw:flex tw:justify-start tw:items-center tw:gap-1">
              <Icon path='mdiLightningBolt' />
            </div>
            <div className="tw:flex-1 tw:flex tw:flex-col tw:justify-start tw:items-start tw:gap-3">
              <div className="tw:self-stretch tw:flex tw:flex-col tw:justify-start tw:items-start">
                <div className="tw:self-stretch tw:flex tw:justify-start tw:items-center tw:gap-1.5">
                  <Typography as="div" typographyType="body-md" appearance="strong" className="tw:font-semibold">Auto-fix dependencies</Typography>
                  <div className="tw:px-1 tw:py-px tw:rounded-xs tw:outline tw:-outline-offset-1 tw:outline-violet-200/60 tw:flex tw:justify-center tw:items-center">
                    <Typography as="div" typographyType="title-xs" appearance="strong">BETA</Typography>
                  </div>
                </div>
                <Typography as="div" typographyType="body-md" className="tw:self-stretch tw:justify-start tw:text-violet-200/95">You have Premium — available dependencies can be installed automatically.</Typography>
              </div>
            </div>
            <div data-filled="Strong" data-show-icon-left="true" data-show-icon-right="false" data-show-label="true" data-size="xs" data-state="Default" data-type="Secondary" className="tw:h-6 tw:px-1.5 tw:bg-Neutral-Strong tw:rounded tw:flex tw:justify-start tw:items-center tw:gap-0.5">
              <Button
                buttonType="secondary"
                filled='strong'
                size="sm"
                leftIconPath="mdiDownload"
              >
                Install all</Button>
            </div>
          </div>

          {/* Mod dependency card  */}
          <button className="tw:flex tw:self-stretch tw:px-4 tw:py-3 tw:bg-surface-mid tw:hover:bg-surface-high tw:rounded-sm tw:shadow-lg tw:justify-start tw:items-center tw:gap-3 tw:cursor-pointer tw:transition-colors duration-300">
            <div className="tw:py-1 tw:flex tw:justify-start tw:items-center tw:gap-1">
              <Icon path='mdiAlert' className='tw:text-warning-strong' />
            </div>
            <div className="tw:flex-1 tw:flex tw:flex-col tw:justify-start tw:items-start tw:gap-3">
              <div className="tw:self-stretch tw:flex tw:flex-col tw:justify-start tw:items-start">
                <Typography as="div" typographyType="body-md" appearance="strong">Sprint Swim Redux SKSE requires an additional dependency.</Typography>
                <Typography as="div" typographyType="body-sm" appearance="subdued">You must install the required mod for it to function properly.</Typography>
              </div>
            </div>
            <div className="tw:py-1 tw:flex tw:justify-start tw:items-center tw:gap-1">
              <Icon path='mdiChevronRight' className='tw:text-neutral-translucent-moderate' />
            </div>
          </button>
          
        </div>
      </MainPage.Body>
    </MainPage>
  );
}

export default HealthCheckPage;
