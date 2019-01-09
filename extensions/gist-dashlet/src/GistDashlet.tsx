import * as React from 'react';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';
import { ComponentEx, Dashlet, selectors, util } from 'vortex-api';
import { IAnnouncement, AnnouncementSeverity } from './types';

interface IConnectedProps {
  gameMode: string;
  announcements: Array<{ date: string, description: string, severity: AnnouncementSeverity, githublink?: string, gameMode?: string }>;
}

interface IActionProps {
}

type IProps = IConnectedProps & IActionProps;

class GistDashlet extends ComponentEx<IProps, {}> {
  constructor(props: IProps) {
    super(props);
  }

  public render(): JSX.Element {
    const { t, announcements, gameMode } = this.props;
    
    const filtered = gameMode !== undefined 
      ? announcements.filter(announce => ((announce.gameMode !== undefined) && (announce.gameMode === gameMode)) 
        || announce.gameMode === undefined)
      : announcements.filter(announce => announce.gameMode === undefined);

    return filtered.length > 0 
    ? (<Dashlet className='gist-log' title={t('Announcements')}>
        {this.renderContent(filtered)}
      </Dashlet>) 
    : null;
  }

  private openLink = (evt: React.MouseEvent<HTMLAnchorElement>) => {
    evt.preventDefault();
    const link = evt.currentTarget.getAttribute('data-link');
    util.opn(link).catch(() => null);
  }

  private generateClassName(announcement: IAnnouncement, id: number): string {
    const severity = announcement.severity !== undefined ? announcement.severity : 'information';
    return `announce-${severity} ${id}`;
  }

  private renderContent(filtered: IAnnouncement[]) {
    const { t } = this.props;

    const renderElement = (announcement: IAnnouncement, id: number): JSX.Element => {
      const generateItem = (): JSX.Element => {
        return announcement.githublink !== undefined 
          ? (
            <a 
              className = {this.generateClassName(announcement, id)}
              data-link={announcement.githublink} 
              onClick={this.openLink} 
              href={announcement.githublink}>
              {announcement.description}
            </a>)
          : (
            <span className={this.generateClassName(announcement, id)}>
              {announcement.description}
            </span>);
      };

      return (
        <li>
          <h5>
            {`(${announcement.date}) - `}
            {generateItem()}
          </h5>
        </li>)
    }

    return (
      <ul className='list-announcements'>
        {filtered.map((announcement, id) => renderElement(announcement, id))}
      </ul>
    );
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    gameMode: selectors.activeGameId(state) || undefined,
    announcements: state.session.announcements.announcements,
  };
}

function mapDispatchToProps(dispatch: any): IActionProps {
  return {
  };
}

export default
  connect(mapStateToProps, mapDispatchToProps)(
    translate(['gist-dashlet', 'common'], { wait: true })(
      GistDashlet));
