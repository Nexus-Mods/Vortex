export interface INotificationDismiss {
  (): void;
}

export interface INotificationAction {
  title: string;
  action: (dismiss: INotificationDismiss) => void;
}

export type INotificationType =
  'success' | 'info' | 'error';

export interface INotification {
  id?: string;
  type: INotificationType;
  message: string;
  displayMS?: number;
  actions?: INotificationAction[];
}
