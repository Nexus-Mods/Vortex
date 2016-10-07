import * as Promise from 'bluebird';

export interface ISupportedTools {
    name: string;
    executable: string;
    icon: string;
    location: (toolExecutable: string) => string | Promise<string>;
}
