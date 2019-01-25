import * as React from 'react';
import { connect } from 'react-redux';
import { remote } from 'electron';

import { ComponentEx, translate } from '../../util/ComponentEx';
import Dashlet from '../../controls/Dashlet';
import opn from '../../util/opn';
import * as selectors from '../../util/selectors';
import { Icon, IconButton } from '../../controls/TooltipControls';

import { IAnnouncement, AnnouncementSeverity } from './types';
import { FlexLayout, EmptyPlaceholder } from '../../controls/api';

interface IConnectedProps {
  gameMode: string;
  announcements: Array<{ date: string, description: string, severity: AnnouncementSeverity, link?: string, gameMode?: string, icon? :string, version?: string }>;
}

interface IActionProps {
}

type IProps = IConnectedProps & IActionProps;

class AnnouncementDashlet extends ComponentEx<IProps, {}> {
  private mAppVersion: string;
  constructor(props: IProps) {
    super(props);
  }

  public componentDidMount() {
    this.mAppVersion = remote.app.getVersion();
  }

  public render(): JSX.Element {
    const { t, announcements, gameMode } = this.props;
    
    // Filter announcements by gamemode.
    let filtered = gameMode !== undefined 
      ? announcements.filter(announce => ((announce.gameMode !== undefined) && (announce.gameMode === gameMode)) 
        || announce.gameMode === undefined)
      : announcements.filter(announce => announce.gameMode === undefined);

    // Filter out any announcements that have a specific version set and don't match
    //  the current version of the application.
    filtered = announcements.filter(announce => (announce.version === undefined) 
        || ((announce.version !== undefined) && (announce.version === this.mAppVersion)));

    return <Dashlet className='dashlet-announcement' title={t('Announcements')}>
            {filtered.length > 0 ? this.renderContent(filtered) : this.renderPlaceholder()}
          </Dashlet>;
  }

  private renderPlaceholder(): JSX.Element {
    const { t } = this.props;
    return (
      <EmptyPlaceholder
        icon='announcements'
        text={t('No Announcements')}
        subtext={t('No news is good news!')}
      />
    );
  }

  private openLink = (evt) => {
    evt.preventDefault();
    const link = evt.currentTarget.getAttribute('data-link');
    opn(link).catch(() => null);
  }

  private renderIcon(announcement: IAnnouncement): JSX.Element {
    const { t } = this.props;
    const sev = announcement.severity !== undefined ? announcement.severity : 'information';
    if ((sev !== 'information') && (announcement.icon !== undefined)) {
      return <Icon className={`announcement-icon-${sev}`} key='attention-required' name={announcement.icon} tooltip={t('Icon')} />;
    } else {
      return null;
    }
  }

  private generateExtraPanel(announcement: IAnnouncement): JSX.Element {
    const { t } = this.props;
    const generateLinkButton = (): JSX.Element => {
      return (
        <IconButton 
          className='announcement-open-link-icon'
          data-link={announcement.link}
          icon='about'
          tooltip={t('View Issue')}
          onClick={this.openLink}/>
      )
    };

    const generateDate = (): JSX.Element => (
      <div>
        {new Date(announcement.date).toLocaleDateString(this.context.api.locale())}
      </div>
    );

    return (
      <FlexLayout type='row' className='announcement-extras'>
        {generateDate()}
        {announcement.link !== undefined ? generateLinkButton() : null}
      </FlexLayout>
    );
  }

  private generateDescription = (announcement: IAnnouncement): JSX.Element => {
    const { t } = this.props;
    

    return (
      <FlexLayout type='row' className='announcement-description'>
        {this.renderIcon(announcement)}
        <p>{announcement.description}</p>
      </FlexLayout>
    )
  }

  private renderContent(filtered: IAnnouncement[]) {
    const renderElement = (announcement: IAnnouncement, id: number): JSX.Element => {
      return (
        <li key={id} className='announcement-list-item'>
            <FlexLayout type='column'>
              {this.generateDescription(announcement)}
              {this.generateExtraPanel(announcement)}
            </FlexLayout>
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
    translate(['common'], { wait: true })(
      AnnouncementDashlet));
