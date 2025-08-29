declare module 'glob' {
  interface IOptions {
    cwd?: string;
    root?: string;
    dot?: boolean;
    nomount?: boolean;
    mark?: boolean;
    nosort?: boolean;
    stat?: boolean;
    silent?: boolean;
    strict?: boolean;
    cache?: { [path: string]: any };
    statCache?: { [path: string]: any };
    symlinks?: { [path: string]: any };
    nounique?: boolean;
    nonull?: boolean;
    debug?: boolean;
    nobrace?: boolean;
    noglobstar?: boolean;
    noext?: boolean;
    nocase?: boolean;
    matchBase?: boolean;
    nodir?: boolean;
    ignore?: string | string[];
    follow?: boolean;
    realpath?: boolean;
    absolute?: boolean;
  }

  function glob(pattern: string, cb: (err: Error | null, matches: string[]) => void): void;
  function glob(pattern: string, options: IOptions, cb: (err: Error | null, matches: string[]) => void): void;

  namespace glob {
    function sync(pattern: string, options?: IOptions): string[];
    function hasMagic(pattern: string, options?: IOptions): boolean;
    
    interface IGlob {
      minimatch: any;
      found: string[];
      cache: { [path: string]: any };
      statCache: { [path: string]: any };
      symlinks: { [path: string]: any };
    }
  }

  export = glob;
}

declare function globSync(pattern: string, options?: any): string[];
export = globSync;