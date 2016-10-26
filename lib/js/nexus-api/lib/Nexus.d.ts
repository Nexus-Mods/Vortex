import * as types from './types';
import * as Promise from 'bluebird';
declare class Nexus {
    private mApiKey;
    private mAppId;
    private mRestClient;
    private mBaseData;
    private mBaseURL;
    private mLegacyURL;
    constructor(appId: string);
    validateKey(apiKey: string): Promise<types.IValidateKeyResponse>;
    getModInfo(modId: number): Promise<types.IGetModInfoResponse>;
    getDownloadURLs(fileId: number): Promise<types.IDownloadURL[]>;
    private handleResult(data, response, resolve, reject);
    private args(customArgs);
    private initMethods();
}
export default Nexus;
