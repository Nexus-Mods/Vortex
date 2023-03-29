const NULL_KEY = 'e210e05b-5b22-47ee-96d7-cfd10ae18ef9';

export class RelaxedReselectCache {
  private mCache: Map<string, any>;
  constructor() {
    this.mCache = new Map();
  }
  public set(key: string, selectorFn) {
    this.mCache.set(key ?? NULL_KEY, selectorFn);
  }

  public get(key: string) {
    return this.mCache.get(key ?? NULL_KEY);
  }

  public remove(key: string) {
    this.mCache.delete(key ?? NULL_KEY);
  }

  public clear() {
    this.mCache.clear();
  }

  public isValidCacheKey() {
    return true;
  }
}
