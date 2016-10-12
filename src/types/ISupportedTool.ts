import * as Promise from 'bluebird';

export interface ISupportedTool {
    name: string;
    icon?: string;
    location: () => string | Promise<string>;
}
