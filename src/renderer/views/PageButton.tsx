import * as React from "react";
import { Badge } from "react-bootstrap";
import { useTranslation } from "react-i18next";

import type { IMainPage } from "../../types/IMainPage";
import type { IUpdateable } from "../ReduxProp";

import Icon from "../controls/Icon";
import Spinner from "../controls/Spinner";

interface IPageButtonProps {
  page: IMainPage;
  namespace: string;
}

export function PageButton(props: IPageButtonProps): React.JSX.Element {
  const { namespace, page } = props;
  const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);

  const { t } = useTranslation();

  // Create a stable object to pass to attach/detach that triggers re-renders
  const updateHandle: IUpdateable = React.useMemo(() => ({ forceUpdate }), []);

  React.useEffect(() => {
    if (page.badge) {
      page.badge.attach(updateHandle);
    }
    if (page.activity) {
      page.activity.attach(updateHandle);
    }

    return () => {
      if (page.badge) {
        page.badge.detach(updateHandle);
      }
      if (page.activity) {
        page.activity.detach(updateHandle);
      }
    };
  }, [page, updateHandle]);

  const renderBadge = () => {
    if (page.badge === undefined) {
      return null;
    }
    return <Badge>{page.badge.calculate()}</Badge>;
  };

  const renderActivity = () => {
    if (page.activity === undefined || !page.activity.calculate()) {
      return null;
    }
    return <Spinner />;
  };

  return (
    <div>
      <Icon name={page.icon} />

      <span className="menu-label">{t(page.title, { ns: namespace })}</span>

      {renderBadge()}

      {renderActivity()}
    </div>
  );
}

export default PageButton;
