import * as React from 'react';
import Icon from '../../controls/Icon';
import Spinner from '../../controls/Spinner';
import { IMainPage } from '../../types/IMainPage';
import { TFunction } from '../../util/i18n';
import SidebarButton from './SidebarButton';
import { Badge } from 'react-bootstrap';

export interface ISidebarPageButtonProps {
  t: TFunction;
  page: IMainPage;
  namespace: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  selected?: boolean;
  className?: string;
}

class SidebarPageButton extends React.Component<ISidebarPageButtonProps, {}> {
  public componentDidMount() {
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
    const { t, namespace, page, onClick, selected, className } = this.props;

    return (
      <SidebarButton
        id={page.id}
        onClick={onClick}
        icon={<Icon name={page.icon} />}
        label={t(page.title, { ns: namespace })}
        variant="default"
        selected={selected}
        badge={this.renderBadge()}
        activity={this.renderActivity()}
        className={className}
      />
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

    return <Spinner style={{ width: 12, height: 12 }} />;
  }
}

export default SidebarPageButton;