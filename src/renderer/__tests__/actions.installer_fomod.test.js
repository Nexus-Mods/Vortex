import * as actions from '../extensions/installer_fomod_shared/actions/installerUI';


describe('startDialog', () => {
  it('creates the correct action', () => {
     let installerInfo = {
      moduleName: 'test',
      image: 'test',
    };
    let instanceId = 'testInstance';
    expect(actions.startDialog(installerInfo, instanceId)).toEqual({
      error: false,
      type: 'START_FOMOD_DIALOG',
      payload: { info: installerInfo, instanceId: instanceId },
    });
  });
});

describe('endDialog', () => {
  it('creates the correct action', () => {
    let instanceId = 'testInstance';
    expect(actions.endDialog(instanceId)).toEqual({
      error: false,
      payload: { instanceId: instanceId },
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
    let instanceId = 'testInstance';
    expect(actions.setDialogState(state, instanceId)).toEqual({
      error: false,
      type: 'SET_FOMOD_DIALOG_STATE',
      payload: { dialogState: state, instanceId: instanceId },
    });
  });
});
