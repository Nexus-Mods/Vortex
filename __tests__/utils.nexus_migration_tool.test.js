import { parseNMMInstall } from '../extensions/nexus-migration-tool/src/util/nmmVirtualConfigParser';
import {IFileEntry as FileEntry, IModEntry as ModEntry} from '../extensions/nexus-migration-tool/src/types/nmmEntries';

describe('parseNMMInstall', () => {
  it('parse the NMM virtual config file', () => {
    const fileInput = '../../../../__tests__/nexus_migration_tool/ProperConfig.xml';
    const fileEntry = {
          fileSource: 'TestPath',
          fileDestination: 'TestPath',
          isActive: true,
          filePriority: '0',
      };
    const modEntry = {
      nexusId: '1',
      vortexId: 'TestMod',
      downloadId: '1',
      modName: 'TestMod',
      modFilename: 'TestMod',
      archivePath: '',
      modVersion: '1.0.0',
      archiveMD5: '',
      importFlag: true,
      isAlreadyManaged: false,
      fileEntries: fileEntry,
    };
    let result;
    parseNMMInstall(fileInput, undefined)
    .then((ModEntries) => {
      result = ModEntries;
    })
    .then(() => {
      expect(result).toEqual(modEntry);
    });
  });
  it('parse a mismatched NMM config file', () => {
    const fileInput = '../../../../__tests__/nexus_migration_tool/Mismatched.xml';
    const expectedError = 'The selected folder contains an older VirtualModConfig.xml file,'
        + 'you need to upgrade your NMM before proceeding with the mod import.';
    let result;
    parseNMMInstall(fileInput, undefined)
    .then((ModEntries) => {
      result = ModEntries;
    })
    .then(() => {
      expect(result).toEqual(expectedError);
    });
  });
  it('parse an invalid NMM config file', () => {
    const fileInput = '../../../../__tests__/nexus_migration_tool/Invalid.xml';
    const expectedError = 'The selected folder does not contain a valid VirtualModConfig.xml file.';
    let result;
    parseNMMInstall(fileInput, undefined)
    .then((ModEntries) => {
      result = ModEntries;
    })
    .then(() => {
      expect(result).toEqual(expectedError);
    });
  });
  it('parse an empty NMM config file', () => {
    const fileInput = '../../../../__tests__/nexus_migration_tool/EmptyList.xml';
    const expectedError = 'The selected folder contains an empty VirtualModConfig.xml file.';
    let result;
    parseNMMInstall(fileInput, undefined)
    .then((ModEntries) => {
      result = ModEntries;
    })
    .then(() => {
      expect(result).toEqual(expectedError);
    });
  });
});