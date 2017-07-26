import { parseModEntries } from '../extensions/nexus-migration-tool/src/util/nmmVirtualConfigParser';

describe('parseModEntries', () => {
  it('parse the NMM virtual config file', () => {
    const inputXML = `<virtualModActivator fileVersion="0.3.0.0">
                      <modList>
                      <modInfo modId="1" downloadId="1" updatedDownloadId="" modName="TestMod" modFileName="TestMod" modNewFileName="" modFilePath="" FileVersion="1.0.0">
                      <fileLink realPath="TestPath" virtualPath="TestPath">
                      <linkPriority>0</linkPriority>
                      <isActive>True</isActive>
                      </fileLink>
                      </modInfo>
                      </modlist>
                      </virtualModActivator>`;
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
    parseModEntries(inputXML, undefined)
    .then((ModEntries) => {
      result = ModEntries;
    })
    .then(() => {
      expect(result).toEqual(modEntry);
    });
  });
  /*it('parse a mismatched NMM config file', () => {
    const fileInput = '../../../../__tests__/nexus_migration_tool/Mismatched.xml';
    const expectedError = 'The selected folder contains an older VirtualModConfig.xml file,'
        + 'you need to upgrade your NMM before proceeding with the mod import.';
    let result;
    parseModEntries(fileInput, undefined)
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
    parseModEntries(fileInput, undefined)
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
    parseModEntries(fileInput, undefined)
    .then((ModEntries) => {
      result = ModEntries;
    })
    .then(() => {
      expect(result).toEqual(expectedError);
    });
  });*/
});