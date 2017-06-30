export interface IProfileFeature {
  id: string;
  icon: string;
  type: string;
  description: string;
  supported: () => boolean;
}
