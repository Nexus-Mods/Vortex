import { installerUIReducer } from '../src/extensions/installer_fomod_shared/reducers/installerUI';

describe('startDialog', () => {
  it('starts the installer dialog', () => {
    let input = { 
      activeInstanceId: null,
      instances: {} 
    };
    let installerInfo = {
      moduleName: 'test',
      image: 'test',
    };
    let instanceId = 'testInstance';
    let result = installerUIReducer.reducers.START_FOMOD_DIALOG(input, { info: installerInfo, instanceId });
    expect(result).toEqual({ 
      activeInstanceId: instanceId,
      instances: {
        [instanceId]: {
          info: installerInfo
        }
      }
    });
  });
});

describe('endDialog', () => {
  it('ends the installer dialog', () => {
    let instanceId = 'testInstance';
    let input = { 
      activeInstanceId: instanceId,
      instances: {
        [instanceId]: {
          info: { modulename: 'test', image: 'test' }
        }
      }
    };
    let result = installerUIReducer.reducers.END_FOMOD_DIALOG(input, { instanceId });
    expect(result).toEqual({
      activeInstanceId: null,
      instances: {}
    });
  });
});

describe('setDialogState', () => {
  it('sets the installer dialog state', () => {
    let instanceId = 'testInstance';
    let input = { 
      activeInstanceId: instanceId,
      instances: {
        [instanceId]: {}
      }
    };
    let state = {
      installSteps: [],
      currentStep: 1,
    };
    let result = installerUIReducer.reducers.SET_FOMOD_DIALOG_STATE(input, { dialogState: state, instanceId });
    expect(result).toEqual({
      activeInstanceId: instanceId,
      instances: {
        [instanceId]: {
          state: state
        }
      }
    });
  });
});

describe('setInstallerDataPath', () => {
  it('sets the installer data path', () => {
    let instanceId = 'testInstance';
    let input = { 
      activeInstanceId: instanceId,
      instances: {
        [instanceId]: {}
      }
    };
    let result = installerUIReducer.reducers.SET_INSTALLER_DATA_PATH(input, { path: 'new path', instanceId });
    expect(result).toEqual({
      activeInstanceId: instanceId,
      instances: {
        [instanceId]: {
          dataPath: 'new path'
        }
      }
    });
  });
  it('fails if the data path is null', () => {
    let instanceId = 'testInstance';
    let input = { 
      activeInstanceId: instanceId,
      instances: {
        [instanceId]: {}
      }
    };
    let result = installerUIReducer.reducers.SET_INSTALLER_DATA_PATH(input, { path: null, instanceId });
    expect(result).toEqual({
      activeInstanceId: instanceId,
      instances: {
        [instanceId]: {
          dataPath: null
        }
      }
    });
  });
});
