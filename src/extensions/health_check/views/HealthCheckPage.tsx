import * as React from 'react';
import { useTranslation } from 'react-i18next';

import MainPage from '../../../views/MainPage';

function HealthCheckPage() {
  const { t } = useTranslation();

  return (
    <MainPage id='health-check-page'>
      <MainPage.Body>
        <div className="tw:p-5">
          <h2>{t('Health Check')}</h2>
        </div>
      </MainPage.Body>
    </MainPage>
  );
}

export default HealthCheckPage;
