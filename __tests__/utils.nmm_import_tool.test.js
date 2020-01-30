import { parseModEntries } from '../extensions/nmm-import-tool/src/util/nmmVirtualConfigParser';
import { ParseError } from '../extensions/nmm-import-tool/src/types/nmmEntries';

import { Readable } from 'stream';

jest.mock('vortex-api', () => ({
  fs: {
    statAsync: () => {
      return Promise.resolve({});
    },
  },
  util: {
    deriveInstallName: (input) => input,
  },
}));

jest.mock('modmeta-db', () => ({
  genHash: () => Promise.resolve({ md5sum: 'fake hash' }),
}));

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
                      </modList>
                      </virtualModActivator>`;

    const modEntry = new Array({
      nexusId: '1',
      vortexId: 'TestMod',
      downloadId: 1,
      modName: 'TestMod',
      modFilename: 'TestMod',
      archivePath: '',
      modVersion: '1.0.0',
      archiveMD5: 'fake hash',
      importFlag: true,
      isAlreadyManaged: false,
    });
    return parseModEntries(inputXML, undefined)
    .then(result => {
      expect(result).toEqual(modEntry);
    });
  });
  it('parse a mismatched NMM config file', () => {
    const inputXML = `<?xml version="1.0" encoding="utf-8"?>
                      <virtualModActivator fileVersion="0.2.0.0">
                        <modList />
                      </virtualModActivator>`;
    const expectedError = new ParseError('The selected folder contains an older VirtualModConfig.xml file,'
        + 'you need to upgrade your NMM before proceeding with the mod import.');
    let result;
    return parseModEntries(inputXML, undefined)
    .then((ModEntries) => {
      result = ModEntries;
    })
    .then(() => {
      expect(result).toEqual(expectedError);
    })
    .catch((err) => {
      expect(err).toEqual(expectedError);
    });
  });
  it('parse an invalid NMM config file', () => {
    const inputXML = `<?xml version="1.0" encoding="utf-8"?>
                      <invalidModActivator>
                        <modList />
                      </invalidModActivator>`;
    const expectedError = new ParseError('The selected folder does not contain a valid VirtualModConfig.xml file.');
    let result;
    return parseModEntries(inputXML, undefined)
    .then((ModEntries) => {
      result = ModEntries;
    })
    .then(() => {
      expect(result).toEqual(expectedError);
    })
    .catch((err) => {
      expect(err).toEqual(expectedError);
    });
  });
  it('parse an empty NMM config file', () => {
    const inputXML = `<?xml version="1.0" encoding="utf-8"?>
                      <virtualModActivator fileVersion="0.3.0.0">
                        <modList />
                      </virtualModActivator>`;
    const expectedError = new ParseError('The selected folder contains an empty VirtualModConfig.xml file.');
    let result;
    return parseModEntries(inputXML, undefined)
    .then((ModEntries) => {
      result = ModEntries;
    })
    .then(() => {
      expect(result).toEqual(expectedError);
    })
    .catch((err) => {
      expect(err).toEqual(expectedError);
    });
  });
});