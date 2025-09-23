declare module 'electron-spotlight' {
  export function addItems(items: Array<{id: string, title: string, subtitle?: string, icon?: string}>): Promise<void>;
  export function removeItems(ids: string[]): Promise<void>;
  export function removeAllItems(): Promise<void>;
  
  // Default export
  export default {
    addItems,
    removeItems,
    removeAllItems
  };
}