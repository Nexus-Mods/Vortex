export interface INotificationDismiss {
  (): void;
}

export interface INotificationAction {
  title: string;
  action: (dismiss: INotificationDismiss) => void;
}

export type NotificationType =
  'activity' | 'success' | 'info' | 'error';

export interface INotification {
  id?: string;
  type: NotificationType;
  message: string;
  displayMS?: number;
  actions?: INotificationAction[];
}
