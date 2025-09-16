/* eslint-env jest */
import { installerUIReducer } from '../src/extensions/installer_fomod/reducers/installerUI';

describe('startDialog', () => {
  it('starts the installer dialog', () => {
    const input = { activeInstanceId: null, instances: {} };
    const installerInfo = {
      moduleName: 'test',
      image: 'test',
    };
    const payload = { instanceId: 'test-instance', info: installerInfo };
    const result = installerUIReducer.reducers.START_FOMOD_DIALOG(input, payload);
    expect(result).toEqual({ 
      activeInstanceId: 'test-instance', 
      instances: { 'test-instance': { info: installerInfo } } 
    });
  });
});

describe('endDialog', () => {
  it('ends the installer dialog', () => {
    const input = { 
      activeInstanceId: 'test-instance', 
      instances: { 'test-instance': { info: { modulename: 'test', image: 'test' } } } 
    };
    const payload = { instanceId: 'test-instance' };
    const result = installerUIReducer.reducers.END_FOMOD_DIALOG(input, payload);
    expect(result).toEqual({ activeInstanceId: null, instances: {} });
  });
});

describe('setDialogState', () => {
  it('sets the installer dialog state', () => {
    const input = { activeInstanceId: null, instances: {} };
    const state = {
      installSteps: [],
      currentStep: 1,
    };
    const payload = { instanceId: 'test-instance', dialogState: state };
    const result = installerUIReducer.reducers.SET_FOMOD_DIALOG_STATE(input, payload);
    expect(result).toEqual({ 
      activeInstanceId: null, 
      instances: { 'test-instance': { state: state } } 
    });
  });
});

describe('setInstallerDataPath', () => {
  it('sets the installer data path', () => {
    const input = { activeInstanceId: null, instances: {} };
    const payload = { instanceId: 'test-instance', path: 'new path' };
    const result = installerUIReducer.reducers.SET_INSTALLER_DATA_PATH(input, payload);
    expect(result).toEqual({ 
      activeInstanceId: null, 
      instances: { 'test-instance': { dataPath: 'new path' } } 
    });
  });
  it('fails if the data path is null', () => {
    const input = { activeInstanceId: null, instances: {} };
    const payload = { instanceId: 'test-instance', path: null };
    const result = installerUIReducer.reducers.SET_INSTALLER_DATA_PATH(input, payload);
    expect(result).toEqual({ 
      activeInstanceId: null, 
      instances: { 'test-instance': { dataPath: null } } 
    });
  });
});
