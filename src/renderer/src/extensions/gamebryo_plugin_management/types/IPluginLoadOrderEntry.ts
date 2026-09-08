export interface IPluginLoadOrderEntry {
  // display name of the plugin; the loadOrder reducer writes it on every entry it creates, but
  // entries hydrated from older persisted state may lack it
  name?: string;
  enabled: boolean | "ghost";
  loadOrder: number;
}
