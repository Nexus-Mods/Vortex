declare module "node-rest-client" {
  interface ICallback {
    (data: any, response: any): void
  }
  export class Client {
    public get(url: string, args: any, callback: ICallback);
  }
}
