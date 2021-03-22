export class NoDeployment extends Error {
  constructor() {
    super('No supported deployment method');
    this.name = this.constructor.name;
    this['allowReport'] = false;
  }
}
