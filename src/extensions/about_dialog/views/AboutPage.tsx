import More from '../../../controls/More';
import { ComponentEx, translate } from '../../../util/ComponentEx';
import github from '../../../util/github';
import {log} from '../../../util/log';
import MainPage from '../../../views/MainPage';

import { ILicense } from '../types/ILicense';

import { remote } from 'electron';
import * as fs from 'fs';
import I18next from 'i18next';
import * as path from 'path';
import * as React from 'react';
import { Image, Media, Panel } from 'react-bootstrap';
import ReactMarkdown from 'react-markdown';

let modules = {};
let ownLicenseText: string = '';
if (remote !== undefined) {
  try {
    const modulesPath = path.join(remote.app.getAppPath(), 'assets', 'modules.json');
    modules = JSON.parse(fs.readFileSync(modulesPath, { encoding: 'utf8' }));
    ownLicenseText = fs.readFileSync(path.join(remote.app.getAppPath(), 'LICENSE.md')).toString();
  } catch (err) {
    // should we display this in the ui? It shouldn't ever happen in the release and 99% of users
    // won't care anyway.
    log('error', 'failed to read license files', err.message);
  }
}

export interface IBaseProps {
  onHide: () => void;
}

interface IComponentState {
  selectedLicense: string;
  licenseText: string;
  ownLicense: boolean;
  releaseDate: Date;
  changelog: string;
  tag: string;
}

type IProps = IBaseProps;

class AboutPage extends ComponentEx<IProps, IComponentState> {
  private mMounted: boolean;
  private mVersion: string;
  private mAppPath: string;
  constructor(props) {
    super(props);
    this.mMounted = false;
    this.initState({
      selectedLicense: undefined,
      licenseText: undefined,
      ownLicense: false,
      releaseDate: undefined,
      changelog: undefined,
      tag: undefined,
    });

    this.mVersion = remote.app.getVersion();
    this.mAppPath = remote.app.getAppPath();
  }

  public componentDidMount() {
    this.mMounted = true;

    if (this.mVersion === '0.0.1') {
      this.nextState.tag = 'Development';
    } else {
      github.releases()
        .then(releases => {
          if (this.mMounted) {
            try {
              const thisVersion = 'v' + this.mVersion;
              const thisRelease = releases.find(rel => rel.tag_name === thisVersion);
              if (thisRelease !== undefined) {
                this.nextState.releaseDate = new Date(thisRelease.published_at);
                this.nextState.changelog = thisRelease.body;
                this.nextState.tag = thisRelease.prerelease ? 'Beta' : undefined;
              } else {
                this.nextState.tag = 'Unknown';
              }
            } catch (err) {
              log('warn', 'Failed to parse release info', err.message);
            }
          }
        })
        .catch(err => {
          log('warn', 'Failed to look up current Vortex releases', err.message);
        });
    }
  }

  public componentWillUnmount() {
    this.mMounted = false;
  }

  public render(): JSX.Element {
    const { t } = this.props;
    const { changelog, ownLicense, tag, releaseDate } = this.state;

    const moduleList = Object.keys(modules).map(key => ({ key, ...modules[key] }));

    const imgPath = path.resolve(this.mAppPath, 'assets', 'images', 'vortex.png');

    let body = null;

    const licenseBox = ownLicense
      ? (
        <ReactMarkdown
          className='license-text-own'
          disallowedElements={['link']}
        >
          {ownLicenseText}
        </ReactMarkdown>
      ) : (
        <div className='third-party-box'><div><h4>{t('Third-party libraries')}</h4></div>
        <div className='about-panel'>
          {moduleList.map(this.renderModule)}
        </div>
      </div>
      );

    const PanelX: any = Panel;
    body = (
      <MainPage.Body id='about-dialog'>
        <Panel>
          <PanelX.Body>
            <Media style={{ marginBottom: 5, display: 'block' }}>
              <Media.Left><Image src={imgPath} /></Media.Left>
              <Media.Body>
                <h2 className='media-heading'>
                  Vortex {this.mVersion}
                  {(tag !== undefined) ? ' ' + tag : ''}
                </h2>
                <p>&#169;2020 Black Tree Gaming Ltd.</p>
                <p>
                  {t('Released under')}
                  {' '}<a onClick={this.showOwnLicense}>GPL-3</a>{' '}
                  {t('License')}
                </p>
                {(releaseDate !== undefined) ? (
                  <div>
                    {t('Released on {{date}}', { replace:
                      { date: releaseDate.toLocaleDateString(I18next.language) } })}
                    <More id='about-vortex-changelog' name='changelog'>
                      {changelog}
                    </More>
                 </div>
                 ) : null}
              </Media.Body>
            </Media>
            <p><strong>Electron</strong> {(process.versions as any).electron}</p>
            <p><strong>Node</strong> {process.versions.node}</p>
            <p><strong>Chrome</strong> {(process.versions as any).chrome}</p>
            {licenseBox}
          </PanelX.Body>
        </Panel>
      </MainPage.Body>
    );

    return (
      <MainPage>
        {body}
      </MainPage>
    );
  }

  private showOwnLicense = () => {
    this.nextState.ownLicense = !this.state.ownLicense;
  }

  private selectLicense = (evt) => {
    const {t} = this.props;

    const modKey = evt.currentTarget.href.split('#')[1];
    if (this.state.selectedLicense === modKey) {
      this.nextState.selectedLicense = undefined;
      return;
    }

    this.nextState.selectedLicense = modKey;

    const mod: ILicense = modules[modKey];
    const license = typeof (mod.licenses) === 'string' ? mod.licenses : mod.licenses[0];
    const licenseFile = mod.licenseFile !== undefined
      ? path.join(this.mAppPath, mod.licenseFile)
      : path.join(this.mAppPath, 'assets', 'licenses', license + '.md');
    fs.readFile(licenseFile, { }, (err, licenseText) => {
      if (!this.mMounted) {
        return;
      }
      if (err !== null) {
        this.nextState.licenseText = t('Missing license {{licenseFile}}',
          { replace: { licenseFile } });
      } else {
        this.nextState.licenseText = licenseText.toString();
      }
    });
  }

  private renderModule = (mod: ILicense) => {
    const { t } = this.props;
    const { licenseText, selectedLicense } = this.state;
    const licenseBox = mod.key !== selectedLicense
      ? null
      : (
        <ReactMarkdown
          className='license-text'
          disallowedElements={['link']}
        >
        {licenseText || ''}
        </ReactMarkdown>
      );
    return (
      <div key={mod.key}>
        <h5 style={{ display: 'inline' }}>{mod.name} ({mod.version})</h5>
        {' '}
        <h6 style={{ display: 'inline' }}>
          <sup>
            <a href={`#${mod.key}`} onClick={this.selectLicense}>{mod.licenses} {t('License')}</a>
          </sup>
        </h6>
        {licenseBox}
      </div>
    );
  }
}

export default
  translate(['common'])(
    AboutPage) as React.ComponentClass<IBaseProps>;
