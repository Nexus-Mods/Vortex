import * as React from 'react';
import { useTranslation } from 'react-i18next';

import MainPage from '../../../views/MainPage';

function HealthCheckPage() {
  const { t } = useTranslation(['health_check', 'common']);

  return (
    <MainPage id='health-check-page'>
      <MainPage.Body>
        <div className="tw:p-5">
          <h2>{t('health_check:title')}</h2>
        </div>
      </MainPage.Body>
    </MainPage>
  );
}

export default HealthCheckPage;
