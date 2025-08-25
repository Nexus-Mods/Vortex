/* eslint-env jest */
import { installerUIReducer } from '../src/extensions/installer_fomod/reducers/installerUI';

describe('startDialog', () => {
  it('starts the installer dialog', () => {
    let input = { activeInstanceId: null, instances: {} };
    let installerInfo = {
      moduleName: 'test',
      image: 'test',
    };
    let payload = { instanceId: 'test-instance', info: installerInfo };
    let result = installerUIReducer.reducers.START_FOMOD_DIALOG(input, payload);
    expect(result).toEqual({ 
      activeInstanceId: 'test-instance', 
      instances: { 'test-instance': { info: installerInfo } } 
    });
  });
});

describe('endDialog', () => {
  it('ends the installer dialog', () => {
    let input = { 
      activeInstanceId: 'test-instance', 
      instances: { 'test-instance': { info: { modulename: 'test', image: 'test' } } } 
    };
    let payload = { instanceId: 'test-instance' };
    let result = installerUIReducer.reducers.END_FOMOD_DIALOG(input, payload);
    expect(result).toEqual({ activeInstanceId: null, instances: {} });
  });
});

describe('setDialogState', () => {
  it('sets the installer dialog state', () => {
    let input = { activeInstanceId: null, instances: {} };
    let state = {
      installSteps: [],
      currentStep: 1,
    };
    let payload = { instanceId: 'test-instance', dialogState: state };
    let result = installerUIReducer.reducers.SET_FOMOD_DIALOG_STATE(input, payload);
    expect(result).toEqual({ 
      activeInstanceId: null, 
      instances: { 'test-instance': { state: state } } 
    });
  });
});

describe('setInstallerDataPath', () => {
  it('sets the installer data path', () => {
    let input = { activeInstanceId: null, instances: {} };
    let payload = { instanceId: 'test-instance', path: 'new path' };
    let result = installerUIReducer.reducers.SET_INSTALLER_DATA_PATH(input, payload);
    expect(result).toEqual({ 
      activeInstanceId: null, 
      instances: { 'test-instance': { dataPath: 'new path' } } 
    });
  });
   it('fails if the data path is null', () => {
    let input = { activeInstanceId: null, instances: {} };
    let payload = { instanceId: 'test-instance', path: null };
    let result = installerUIReducer.reducers.SET_INSTALLER_DATA_PATH(input, payload);
    expect(result).toEqual({ 
      activeInstanceId: null, 
      instances: { 'test-instance': { dataPath: null } } 
    });
  });
});
