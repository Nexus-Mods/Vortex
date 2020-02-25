export interface IToolStored {
  id: string;
  name: string;
  shortName?: string;
  logo: string;
  executable: string;
  parameters: string[];
  environment: { [key: string]: string };
  shell?: boolean;
  detach?: boolean;
  onStart?: 'hide' | 'hide_recover' | 'close';
  exclusive?: boolean;
  defaultPrimary?: boolean;
}
