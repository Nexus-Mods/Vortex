import Icon from '../controls/Icon';
import Spinner from '../controls/Spinner';
import { IMainPage } from '../types/IMainPage';

import I18next from 'i18next';
import * as React from 'react';
import { Badge } from 'react-bootstrap';

interface IPageButtonProps {
  t: I18next.TFunction;
  page: IMainPage;
}

class PageButton extends React.Component<IPageButtonProps, {}> {
  public componentWillMount() {
    const { page } = this.props;
    if (page.badge) {
      page.badge.attach(this);
    }
    if (page.activity) {
      page.activity.attach(this);
    }
  }

  public componentWillUnmount() {
    const { page } = this.props;
    if (page.badge) {
      page.badge.detach(this);
    }
    if (page.activity) {
      page.activity.detach(this);
    }
  }

  public render() {
    const { t, page } = this.props;
    return (
      <div>
        <Icon name={page.icon} />
        <span className='menu-label'>
          {t(page.title)}
        </span>
        {this.renderBadge()}
        {this.renderActivity()}
      </div>
    );
  }

  private renderBadge() {
    const { page } = this.props;

    if (page.badge === undefined) {
      return null;
    }

    return <Badge>{page.badge.calculate()}</Badge>;
  }

  private renderActivity() {
    const { page } = this.props;

    if ((page.activity === undefined) || !page.activity.calculate()) {
      return null;
    }

    return <Spinner />;
  }
}

export default PageButton;
