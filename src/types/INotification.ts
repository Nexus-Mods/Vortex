export interface INotificationDismiss {
  (): void;
}

export interface INotificationAction {
  title: string;
  action: (dismiss: INotificationDismiss) => void;
}

export type NotificationType =
  'activity' | 'success' | 'info' | 'error';

/**
 * a notification message
 * 
 * @export
 * @interface INotification
 */
export interface INotification {
  /**
   * unique id of the notification. can be left out as
   * the notification system generates its own.
   * Manually set an id if you intend to programatically stop
   * the notification
   * 
   * @type {NotificationType}
   * @memberOf INotification
   */
  id?: string;
  /**
   * the kind of notification to display. This mostly determines
   * its look
   * 
   * @type {NotificationType}
   * @memberOf INotification
   */
  type: NotificationType;
  /**
   * the message to display. This shouldn't be long
   * 
   * @type {string}
   * @memberOf INotification
   */
  message: string;
  /**
   * the duration to display the message. If this is undefined, the
   * message has to be dismissed by the user.
   * Giving a duration may be convenient for the user but it is impossible to
   * correctly estimate the time it takes a user to read a message. Please
   * take into consideration that a user may be forced to read the message in
   * a language not native to him and in general some people simply read slower
   * than others.
   * Also you can't assume the user starts reading the message immediately when
   * it gets displayed, he may be presented with multiple messages at once.
   * The ui may not even be visible at the time the message gets shown.
   * 
   * Therefore: Absolutely never display an important message with a timer!
   * 
   * @type {number}
   * @memberOf INotification
   */
  displayMS?: number;
  /**
   * actions to offer with the notification. These will be presented as buttons.
   * Due to limited space you should not have more than one or two actions and
   * usually combining actions with displayMS is probably a bad idea as it would
   * require the user to act in a limited time.
   *
   * @type {INotificationAction[]}
   * @memberOf INotification
   */
  actions?: INotificationAction[];
}
