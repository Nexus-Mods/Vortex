import * as React from "react";
import { useTranslation } from "react-i18next";

import MainPage from "../../../renderer/views/MainPage";

function HealthCheckPage() {
  const { t } = useTranslation(["health_check", "common"]);

  return (
    <MainPage id="health-check-page">
      <MainPage.Body>
        <div className="p-5">
          <h2 className="m-0">{t("title")}</h2>
        </div>
      </MainPage.Body>
    </MainPage>
  );
}

export default HealthCheckPage;
