import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { showError } from '../../../util/message';
import { IconButton } from '../../../views/TooltipControls';

import { setLicenseText } from '../actions/session';
import { ILicense } from '../types/ILicense';
import retrieveLicenseText from '../util/retrieveLicenseText';

import { app as appIn, remote } from 'electron';
import * as path from 'path';
import * as React from 'react';
import { Button, ControlLabel, FormControl, FormGroup, Image, Modal } from 'react-bootstrap';

let app = appIn || remote.app;

export interface IBaseProps {
  shown: boolean;
  onHide: () => void;
}

interface IActionProps {
  onSetLicenseText: (licenseText: string) => void;
  onShowError: (message: string, details: string | Error) => void;
}

interface IConnectedProps {
  licenseText: string;
}

interface IComponentState { }

type IProps = IBaseProps & IConnectedProps & IActionProps;

class AboutDialog extends ComponentEx<IProps, IComponentState> {
  public render(): JSX.Element {
    const { licenseText, t, shown, onHide } = this.props;
    const fs = require('fs-extra-promise');
    const modules = fs.readJSONSync(path.join(remote.app.getAppPath(), 'assets', 'modules.json'));

    let moduleList = [];
    let modulesKeys = Object.keys(modules);
    modulesKeys.forEach((key) => {
      let module: ILicense = { moduleName: key, licenseName: modules[key].licenses };
      moduleList.push(module);
    });

    let imgPath = path.resolve('out', 'assets', 'images', 'nmm.png');

    return (
      <Modal show={shown} onHide={onHide}>
        <Modal.Header>
          <Modal.Title>
            {t('About')}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <form>
            <FormGroup>
              <div style={{ textAlign: 'center' }}>
                <Image
                  src={imgPath}
                  width='50px'
                  height='50px'
                />
              </div>
              <FormControl
                id='Nexus'
                key='Nexus'
                readOnly
                value={`${t('Info')}: Nexus Manager`}
              />
              <FormControl
                id='Version'
                key='Version'
                readOnly
                value={`${t('Version')}: ${app.getVersion()}`}
              />
              <FormControl
                id='Contributers'
                key='Contributers'
                readOnly
                value={`${t('Contributors')}:`}
              />
              <div className='about-panel'>
                {this.getModules(moduleList)}
              </div>
              <FormControl
                id='License'
                key='License'
                readOnly
                value={`${t('License')}:`}
              />
              <div className='about-panel'>
                {licenseText}
              </div>
            </FormGroup>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            id='close'
            onClick={onHide}
          >
            {t('Close')}
          </Button>
        </Modal.Footer>
      </Modal>
    );
  }

  private setLicenseText = (evt) => {
    const {onSetLicenseText, onShowError } = this.props;

    try {
      onSetLicenseText(evt.currentTarget.value);
    } catch (err) {
      onShowError('An error occurred showing the license', err);
    }
  }

  private getModules = (moduleList) => {
    const {t} = this.props;

    let modules = moduleList.map((module, j) => {

      let license = retrieveLicenseText(module.licenseName);

      return (
        <div key={module.moduleName}>
          <ControlLabel>
            - {module.moduleName} | License: {module.licenseName}
          </ControlLabel>
          <IconButton
            className='btn-embed'
            id={module.licenseName}
            tooltip={license !== '' ? t('License') : t('No License')}
            icon={license !== '' ? 'file-text' : 'times-rectangle'}
            value={license}
            onClick={this.setLicenseText}
          />
        </div>
      );
    });

    return modules;
  }
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetLicenseText: (licenseText: string) => {
      dispatch(setLicenseText(licenseText));
    },
    onShowError: (message: string, details: string | Error) => {
      showError(dispatch, message, details);
    },
  };
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    licenseText: state.session.about.licenseText,
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(AboutDialog)
  ) as React.ComponentClass<IBaseProps>;
