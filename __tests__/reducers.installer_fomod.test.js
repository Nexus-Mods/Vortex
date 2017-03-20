import { installerUIReducer } from '../src/extensions/installer_fomod/reducers/installerUI';

describe('startDialog', () => {
  it('starts the installer dialog', () => {
    let input = { info: {} };
    let installerInfo = {
      moduleName: 'test',
      image: 'test',
    };
    let result = installerUIReducer.reducers.START_FOMOD_DIALOG(input, installerInfo );
    expect(result).toEqual({ info: installerInfo });
  });
});

describe('endDialog', () => {
  it('ends the installer dialog', () => {
    let input = { info: { modulename: 'test', image: 'test' } };
    let result = installerUIReducer.reducers.END_FOMOD_DIALOG(input, {} );
    expect(result).toEqual({});
  });
});

describe('setDialogState', () => {
  it('sets the installer dialog state', () => {
    let input = { state: {} };
     let state = {
      installSteps: [],
      currentStep: 1,
    };
    let result = installerUIReducer.reducers.SET_FOMOD_DIALOG_STATE(input, state );
    expect(result).toEqual( {state: state });
  });
});

describe('setInstallerDataPath', () => {
  it('sets the installer data path', () => {
    let input = { dataPath: '' };
    let result = installerUIReducer.reducers.SET_INSTALLER_DATA_PATH(input, {path: 'new path'} );
    expect(result).toEqual( {dataPath: {path: 'new path' } });
  });
   it('fails if the data path is null', () => {
    let input = { dataPath: '' };
    let result = installerUIReducer.reducers.SET_INSTALLER_DATA_PATH(input, {path: null} );
    expect(result).toEqual( {dataPath: {path: null } });
  });
});
