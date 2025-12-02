import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import MainPage from '../../../views/MainPage';
import Tailwind from '../../../tailwind';
import { IState } from '../../../types/IState';
import { ITableAttribute } from '../../../types/ITableAttribute';
import { IDownload } from '../types/IDownload';

export interface IDownloadsPageNextProps {
  active: boolean;
  secondary: boolean;
  columns: (props: () => any) => Array<ITableAttribute<IDownload>>;
  downloadPathForGame: (game: string) => string;
}

function DownloadsPageNext(props: IDownloadsPageNextProps) {
  const { t } = useTranslation(['common']);
  const downloads = useSelector((state: IState) => state.persistent.downloads?.files ?? {});
  const downloadCount = Object.keys(downloads).length;

  return (
    <MainPage id="page-downloads-next">
      <MainPage.Body>
        <div className="tw:flex tw:flex-col tw:h-full tw:bg-surface-low tw:p-6">
          {/* Header */}
          <div className="tw:flex tw:items-center tw:justify-between tw:mb-6">
            <Tailwind.Typography type="heading-lg" className="tw:text-neutral-strong">
              {t('Downloads')}
            </Tailwind.Typography>
            <div className="tw:flex tw:items-center tw:gap-2">
              <span className="tw:px-3 tw:py-1 tw:bg-primary-base tw:text-white tw:rounded-full tw:text-sm tw:font-medium">
                {t('New UI')}
              </span>
            </div>
          </div>

          {/* Content placeholder */}
          <div className="tw:flex-1 tw:flex tw:flex-col tw:items-center tw:justify-center tw:bg-surface-base tw:rounded-lg tw:border tw:stroke-neutral-translucent-weak">
            <Tailwind.Icon path="download" size="xl" className="tw:text-neutral-subdued tw:mb-4" />
            <Tailwind.Typography as="div" appearance="moderate">
              {t('Downloads Page - Work in Progress')}
            </Tailwind.Typography>
            <Tailwind.Typography as="div" appearance="moderate">
              {t('This is the new Tailwind-based Downloads page. Components will be built incrementally.')}
            </Tailwind.Typography>
            <div className="tw:mt-6 tw:px-4 tw:py-2 tw:bg-surface-high tw:rounded tw:text-neutral-subdued">
              {t('{{count}} download(s) in state', { count: downloadCount })}
            </div>
          </div>

          {/* Footer placeholder */}
          <div className="tw:mt-4 tw:p-4 tw:bg-surface-base tw:rounded-lg tw:border tw:border-stroke-low">
            <Tailwind.Typography as="div" appearance="moderate">
              {t('Drop zone and controls will be added here')}
            </Tailwind.Typography>
          </div>
        </div>
      </MainPage.Body>
    </MainPage>
  );
}

export default DownloadsPageNext;
