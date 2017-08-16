import Icon from '../../../controls/Icon';
import { ComponentEx, translate } from '../../../util/ComponentEx';
import {log} from '../../../util/log';

import { ILicense } from '../types/ILicense';

import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as React from 'react';
import { Button, Image, Media, Modal } from 'react-bootstrap';
import * as ReactMarkdown from 'react-markdown';

let modules = {};
let ownLicenseText: string = '';
if (remote !== undefined) {
  try {
    modules = fs.readJSONSync(path.join(remote.app.getAppPath(), 'assets', 'modules.json')) as any;
    ownLicenseText = fs.readFileSync(path.join(remote.app.getAppPath(), 'LICENSE.md')).toString();
  } catch (err) {
    // should we display this in the ui? It shouldn't ever happen in the release and 99% of users
    // won't care anyway.
    log('error', 'failed to read license files', err.message);
  }
}

export interface IBaseProps {
  shown: boolean;
  onHide: () => void;
}

interface IComponentState {
  selectedLicense: string;
  licenseText: string;
  ownLicense: boolean;
}

type IProps = IBaseProps;

class AboutDialog extends ComponentEx<IProps, IComponentState> {
  private mMounted: boolean;
  constructor(props) {
    super(props);
    this.mMounted = false;
    this.initState({
      selectedLicense: undefined,
      licenseText: undefined,
      ownLicense: false,
    });
  }

  public componentDidMount() {
    this.mMounted = true;
  }

  public componentWillUnmount() {
    this.mMounted = false;
  }

  public render(): JSX.Element {
    const { t, shown } = this.props;
    const { ownLicense } = this.state;

    const moduleList = Object.keys(modules).map(key => ({ key, ...modules[key] }));

    const imgPath = path.resolve(remote.app.getAppPath(), 'assets', 'images', 'vortex.png');

    let body = null;

    if (shown) {
      const licenseBox = ownLicense
        ? (
          <ReactMarkdown
            className='license-text-own'
            disallowedTypes={['Link']}
            source={ownLicenseText}
          />
        ) : (
          <div style={{ marginTop: 5 }}><p><strong>{t('Third-party libraries')}</strong></p>
          <div className='about-panel'>
            {moduleList.map(this.renderModule)}
          </div>
        </div>
        );

      body = (
        <Modal.Body id='about-dialog'>
          <Media style={{ marginBottom: 5 }}>
            <Media.Left><Image src={imgPath} /></Media.Left>
            <Media.Body>
              <Media.Heading>Vortex {remote.app.getVersion()}</Media.Heading>
              <p>&#169;2017 Black Tree Gaming Ltd.</p>
              <p>{t('Released under')} <a onClick={this.showOwnLicense}>GPL-3</a> {t('License')}</p>
            </Media.Body>
          </Media>
          <p><strong>Electron</strong> {(process.versions as any).electron}</p>
          <p><strong>Node</strong> {process.versions.node}</p>
          <p><strong>Chrome</strong> {(process.versions as any).chrome}</p>
          {licenseBox}
        </Modal.Body>
      );
    }

    return (
      <Modal show={shown} onHide={this.props.onHide}>
        <Modal.Header>
          <Modal.Title>
            Vortex
          </Modal.Title>
        </Modal.Header>
        {body}
        <Modal.Footer>
          <Button
            id='close'
            onClick={this.props.onHide}
          >
            {t('Close')}
          </Button>
        </Modal.Footer>
      </Modal>
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
      ? path.join(remote.app.getAppPath(), mod.licenseFile)
      : path.join(remote.app.getAppPath(), 'assets', 'licenses', license + '.md');
    fs.readFileAsync(licenseFile)
      .then((licenseText: NodeBuffer) => {
        if (this.mMounted) {
          this.nextState.licenseText = licenseText.toString();
        }
      })
      .catch((err) => {
        this.nextState.licenseText = t('Missing license {{licenseFile}}',
          { replace: { licenseFile } });
      })
      ;
  }

  private renderModule = (mod: ILicense) => {
    const { t } = this.props;
    const { licenseText, selectedLicense } = this.state;
    const licenseBox = mod.key !== selectedLicense
      ? null
      : (
        <ReactMarkdown
          className='license-text'
          disallowedTypes={['Link']}
          source={licenseText || ''}
        />
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
  translate(['common'], { wait: false })(
    AboutDialog) as React.ComponentClass<IBaseProps>;
