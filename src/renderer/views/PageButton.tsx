import Icon from "../controls/Icon";
import Spinner from "../controls/Spinner";
import type { IMainPage } from "../../types/IMainPage";
import type { TFunction } from "../../util/i18n";

import * as React from "react";
import { Badge } from "react-bootstrap";

interface IPageButtonProps {
  t: TFunction;
  page: IMainPage;
  namespace: string;
}

function PageButton(props: IPageButtonProps): React.JSX.Element {
  const { t, namespace, page } = props;
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  // Create a stable object to pass to attach/detach that triggers re-renders
  // ReduxProp expects an object with a forceUpdate method
  const updateHandle = React.useMemo(
    () => ({ forceUpdate }) as unknown as React.Component,
    [],
  );

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
