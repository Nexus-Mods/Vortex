export interface IReference {
    fileMD5?: string;
    versionMatch?: string;
    logicalFileName?: string;
    fileExpression?: string;
}
export declare type RuleType = 'before' | 'after' | 'requires' | 'conflicts' | 'recommends' | 'provides';
export interface IRule {
    type: RuleType;
    reference: IReference;
    comment?: string;
}
export interface IModInfo {
    fileName: string;
    fileSizeBytes: number;
    gameId: string;
    logicalFileName?: string;
    fileVersion: string;
    fileMD5: string;
    sourceURI: any;
    rules?: IRule[];
    expires?: number;
    details?: {
        homepage?: string;
        category?: string;
        description?: string;
        author?: string;
    };
}
export interface ILookupResult {
    key: string;
    value: IModInfo;
}
export interface IIndexResult {
    key: string;
    value: string;
}
export interface IHashResult {
    md5sum: string;
    numBytes: number;
}
