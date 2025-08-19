import { IExtensionApi } from '../../../types/api';


export class Metrics {
  private user: string;
  private version: string;
  private api: IExtensionApi;

  public start(instanceId: string, version: string, api: IExtensionApi) {
    this.user = instanceId;
    this.version = version;
    this.api = api;
  }

  public stop() {
    this.user = null;
  }

  protected sendMetric(eventType: string, entityType: string, entityId: string, metadata: Record<string, any> = {}) {
    if (!this.user || !this.api) {
      return;
    }

    return this.api.emitAndAwait('send-metric', eventType, entityType, entityId, metadata, `Vortex ${this.version}`);
  }

  public trackEvent(action: string, payload: Record<string, any>): void {
    switch (action) {
      case 'collection installation started':
        this.sendMetric('collection_started', 'collection', payload.collection_slug, payload);
        break;
      case 'collection installation completed':
        this.sendMetric('collection_completed', 'collection', payload.collection_slug, payload);
        break;
    }
  }
}


const metrics = new Metrics();
export default metrics;
