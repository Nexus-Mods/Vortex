import { ComponentEx, translate } from '../../../util/ComponentEx';

import { ILicense } from '../types/ILicense';

import {remote} from 'electron';
import * as path from 'path';
import * as React from 'react';
import { Button, Modal } from 'react-bootstrap';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';

export interface IBaseProps {
  shown: boolean;
  onHide: () => void;
}

type IProps = IBaseProps;

class AboutDialog extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, shown, onHide } = this.props;
    const fs = require('fs-extra-promise');
    const modules = fs.readJSONSync(path.join(remote.app.getAppPath(), 'assets', 'modules.json'));
    const licenses = fs.readJSONSync(path.join(remote.app.getAppPath(), 'assets', 'licenses.json'));

    let licenseList = [];
    let moduleList = [];
    let modulesKeys = Object.keys(modules);
    modulesKeys.forEach((key) => {
      let module: ILicense = { moduleName: key, licenseName: modules[key].licenses };
      moduleList.push(module);
    });

    let licensesKeys = Object.keys(licenses);
    licensesKeys.forEach((key) => {
      licenseList = licenses[key].map((item) => {
        return item;
      });

    });

    return (
      <Modal show={shown} onHide={onHide}>
        <Modal.Header>
          <Modal.Title>
            {t('License list')}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div>
            <Tabs
              selectedIndex={0}
            >
              <TabList>
                {licenseList.map((license, i) => (
                  <Tab key={i}>
                    {license.name}
                  </Tab>
                ))}
              </TabList>
              {licenseList.map((license, i) =>
                <TabPanel key={i}>
                  {
                    renderTextarea(license, moduleList)
                  }
                </TabPanel>)}
            </Tabs>
          </div>
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
}

function renderTextarea(license, moduleList) {

  let selected = moduleList.filter((module) => module.licenseName === license.name);

  return (
    <textarea
      value={getModules(selected)}
      readOnly
      id={'textarea-licenses'}
      style={{ width: '100%', minHeight: 200, resize: 'none', border: 'none' }}
    />
  );
}

function getModules(selected) {

  let modules: string = '';
  selected.map((module, j) =>
    modules = modules.concat(module.moduleName + '\n')
  );

  return modules;
}

export default
  translate(['common'], { wait: false })(AboutDialog) as React.ComponentClass<IBaseProps>;
