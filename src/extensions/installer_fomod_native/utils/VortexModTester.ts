import { testSupported, types as vetypes } from 'fomod-installer-native';
import { ISupportedResult } from '../../../types/api';

export class VortexModTester {
  /**
   * Calls FOMOD's testSupport and converts the result to Vortex data
   */
  public testSupport = (files: string[], allowedTypes: string[]): Promise<ISupportedResult> => {
    try {
    const result = testSupported(files, allowedTypes);
    return Promise.resolve({
      supported: result.supported,
      requiredFiles: result.requiredFiles,
    });
    } catch (error) {
      return Promise.resolve({
        supported: false,
        requiredFiles: [],
      });
    }
  };
}
