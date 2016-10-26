declare module "node-rest-client" {
  interface ICallback {
    (data: any, response: any): void
  }

  type QueryMethod = 'GET' | 'POST';

  export class Client {
    public methods: any; 
    public get(url: string, args: any, callback: ICallback);
    public registerMethod(name: string, url: string, method: QueryMethod);
  }
}
