import * as React from 'react';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';
import { ComponentEx, Dashlet, selectors, util } from 'vortex-api';
import { IGistNode } from './types';

interface IConnectedProps {
  gameMode: string;
  gists: Array<{ date: string, description: string, githublink?: string, gameMode?: string }>;
}

interface IActionProps {
}

type IProps = IConnectedProps & IActionProps;

class GistDashlet extends ComponentEx<IProps, {}> {
  constructor(props: IProps) {
    super(props);
  }

  public render(): JSX.Element {
    const { t, gists, gameMode } = this.props;
    
    const filtered = gameMode !== undefined 
      ? gists.filter(gist => ((gist.gameMode !== undefined) && (gist.gameMode === gameMode)) 
        || gist.gameMode === undefined)
      : gists.filter(gist => gist.gameMode === undefined);

    return filtered.length > 0 
    ? (<Dashlet className='gist-log' title={t('Notification')}>
        {this.renderContent(filtered)}
      </Dashlet>) 
    : null;
  }

  private openLink = (evt: React.MouseEvent<HTMLAnchorElement>) => {
    evt.preventDefault();
    const link = evt.currentTarget.getAttribute('data-link');
    util.opn(link).catch(() => null);
  }

  private renderContent(filtered: IGistNode[]) {
    const { t } = this.props;

    const renderElement = (gist: IGistNode): JSX.Element => {
      return gist.githublink !== undefined 
        ? (<li>
            {`(${gist.date}) - `}
              <a 
                data-link={gist.githublink} 
                onClick={this.openLink} 
                href={gist.githublink}>
                {gist.description}
              </a>
          </li>)
        : (<li>{`(${gist.date}) - ${gist.description}`}</li>)
    }

    return (
      <ul>
        {filtered.map(gist => renderElement(gist))}
      </ul>
    );
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    gameMode: selectors.activeGameId(state) || undefined,
    gists: state.session.gists.gists,
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
