export type NotificationDismiss = () => void;

export interface INotificationAction {
  title: string;
  action: (dismiss: NotificationDismiss) => void;
}

export type NotificationType =
  'activity' | 'global' | 'success' | 'info' | 'warning' | 'error';

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
   * its look but also features to a degree.
   * Possible values:
   *   - 'activity': a notification that represents an activity. will have a
   *                 spinner icon. Otherwise it looks like an info notification
   *   - 'global': This notification will always be visible, so if the window
   *               doesn't have the focus, this will be displayed as a native
   *               system notification. These notifications can not be
   *               programatically dismissed and actions are not supported
   *   - 'success': notification about a successful operation (ideally the
   *                user should be aware of the operation)
   *   - 'info': neutral information notification
   *   - 'error': Error notification (something went wrong)
   *
   * @type {NotificationType}
   * @memberOf INotification
   */
  type: NotificationType;

  /**
   * progress in percent (0-100). If set, the notification is a progress indicator
   */
  progress?: number;

  /**
   * path to an icon/image to display in the notification.
   * 'global' notifications displayed outside the window will always display an
   * icon so the user can tell which application it is from.
   * If no icon is specified this will fall back to the application icon.
   *
   * @type {string}
   * @memberOf INotification
   */
  icon?: string;

  /**
   * optional title. Should only be one or two words
   *
   * @type {string}
   * @memberOf INotification
   */
  title?: string;

  /**
   * the message to display. This shouldn't be long
   *
   * @type {string}
   * @memberOf INotification
   */
  message: string;

  /**
   * time the notification was created
   */
  createdTime?: number;

  /**
   * time the notification was last updated
   */
  updatedTime?: number;

  /**
   * replacement parameters for the localisation of title and message (the same
   * replacement dictionary will be used for both)
   */
  replace?: { [key: string]: any };

  /**
   * control which part of the notification gets localized. default is true for both
   */
  localize?: {
    title?: boolean,
    message?: boolean,
  };

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
   * if set, notifications with the same group will be grouped together and shown as
   * one entry that can be expanded.
   */
  group?: string;

  /**
   * if set, no Dismiss button is provided automatically
   */
  noDismiss?: boolean;

  /**
   * if set, the user may suppress the notification in the future
   */
  allowSuppress?: boolean;

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

  /**
   * id of the process that triggered this action
   */
  process?: string;
}
