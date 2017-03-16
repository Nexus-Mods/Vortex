import * as actions from '../src/extensions/installer_fomod/actions/installerUI';


describe('startDialog', () => {
  it('creates the correct action', () => {
     let installerInfo = {
      moduleName: 'test',
      image: 'test',
    };
    expect(actions.startDialog(installerInfo)).toEqual({
      type: 'START_FOMOD_DIALOG',
      payload: { moduleName: 'test', image: 'test' },
    });
  });
});

describe('endDialog', () => {
  it('creates the correct action', () => {
    expect(actions.endDialog({})).toEqual({
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
    expect(actions.setDialogState(state)).toEqual({
      type: 'SET_FOMOD_DIALOG_STATE',
      payload: { installSteps: [], currentStep: 1},
    });
  });
});

describe('setInstallerDataPath', () => {
  it('creates the correct action', () => {
    expect(actions.setInstallerDataPath('path')).toEqual({
      type: 'SET_INSTALLER_DATA_PATH',
      payload: 'path',
    });
  });
});
