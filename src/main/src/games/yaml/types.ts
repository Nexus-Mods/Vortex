/** Types matching schema.json for game adaptor YAML files */

export interface GameDef {
  id: string;
  name?: string;
  nexus_domain?: string;
  executable: string;
  images?: {
    hero?: string;
    tile?: string;
    thumbnail?: string;
  };
}

export type EngineDef = string | { name: string; params?: Record<string, unknown> };

export interface RegistryDef {
  path: string;
  key: string;
}

export interface StoresDef {
  steam?: string | string[];
  gog?: string | string[];
  epic?: string | string[];
  xbox?: string | string[];
  registry?: RegistryDef;
}

export interface ToolDef {
  name: string;
  path: string;
  exclusive?: boolean;
  alternative_start?: boolean;
}

export interface MapDef {
  [captureArrow: string]: Record<string, string>;
}

export interface RuleDef {
  name: string;
  from: string;
  to: string;
  root?: string;
  multi?: boolean;
  when?: string[];
  exclude?: string[];
  map?: MapDef;
}

export type DiagnosticSeverity = 'severe' | 'warning';

export type DiagnosticExpect =
  | { destination: string }
  | { destination_regex: string }
  | { mapped: string }
  | { all: DiagnosticExpect[] }
  | { any: DiagnosticExpect[] }
  | { not: DiagnosticExpect };

export interface DiagnosticDef {
  code: string;
  severity: DiagnosticSeverity;
  title: string;
  description: string;
  select?: string;
  expect: DiagnosticExpect;
}

export interface DiagnosticResult {
  code: string;
  severity: DiagnosticSeverity;
  title: string;
  message: string;
  source?: string;
  destination?: string;
}

export interface AdaptorDocument {
  schema_version: string;
  game: GameDef;
  engine?: EngineDef;
  stores?: StoresDef;
  folders?: Record<string, string>;
  tools?: ToolDef[];
  rules: RuleDef[];
  diagnostics?: DiagnosticDef[];
}

/** Nexus games.json entry */
export interface NexusGame {
  id: number;
  domain_name: string;
  name: string;
  forum_url?: string;
  nexusmods_url?: string;
  genre?: string;
  mods?: number;
  downloads?: number;
  approved_date?: number;
}

/** File metadata tree node from nexus file-metadata API */
export interface FileNode {
  path: string;
  name?: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  size?: number;
}
