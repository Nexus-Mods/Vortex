export interface IProfileFeature {
  id: string;
  icon: string;
  label: string;
  type: string;
  description: string;
  supported: () => boolean;
  namespace?: string;
}
