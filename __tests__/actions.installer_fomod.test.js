/* eslint-env jest */
import * as actions from '../src/extensions/installer_fomod/actions/installerUI';


describe('startDialog', () => {
  it('creates the correct action', () => {
     let installerInfo = {
      moduleName: 'test',
      image: 'test',
    };
    expect(actions.startDialog(installerInfo, 'test-instance')).toEqual({
      error: false,
      type: 'START_FOMOD_DIALOG',
      payload: { info: installerInfo, instanceId: 'test-instance' },
    });
  });
});

describe('endDialog', () => {
  it('creates the correct action', () => {
    expect(actions.endDialog('test-instance')).toEqual({
      error: false,
      payload: { instanceId: 'test-instance' },
      type: 'END_FOMOD_DIALOG',
    });
  });
});

describe('setDialogState', () => {
  it('creates the correct action', () => {
    let state = {
      installSteps: [],
      currentStep: 1,
    };
    expect(actions.setDialogState(state, 'test-instance')).toEqual({
      error: false,
      type: 'SET_FOMOD_DIALOG_STATE',
      payload: { dialogState: state, instanceId: 'test-instance'},
    });
  });
});

describe('setInstallerDataPath', () => {
  it('creates the correct action', () => {
    expect(actions.setInstallerDataPath('path', 'test-instance')).toEqual({
      error: false,
      type: 'SET_INSTALLER_DATA_PATH',
      payload: { path: 'path', instanceId: 'test-instance' },
    });
  });
});
