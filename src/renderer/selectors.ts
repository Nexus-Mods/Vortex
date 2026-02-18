import type { IState } from "./types/IState";

export const mainPage = (state: IState) => state.session.base.mainPage;
export const secondaryPage = (state: IState) => state.session.base.secondaryPage;

export const notifications = (state: IState) =>
  state.session.notifications.notifications;
