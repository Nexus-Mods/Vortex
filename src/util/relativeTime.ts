import { TFunction } from './i18n';

const SEC_PER_MIN = 60;
const SEC_PER_HOUR = SEC_PER_MIN * 60;
const SEC_PER_DAY = SEC_PER_HOUR * 24;
const SEC_PER_WEEK = SEC_PER_DAY * 7;
const SEC_PER_MONTH = SEC_PER_DAY * 30;
const SEC_PER_YEAR = SEC_PER_DAY * 365;

export type TimeMode = 'relative' | 'absolute';

let timeMode = 'relative';

export function setTimeMode(mode: TimeMode) {
  timeMode = mode;
}

/**
 * format the specified date in a user-friendly way, depending on the globally set time mode
 */
export function userFriendlyTime(date: Date, t: TFunction, locale: string): string {
  if (timeMode === 'relative') {
    return relativeTime(date, t);
  } else {
    return date.toLocaleString(locale);
  }
}

function relativeTime(date: Date, t: TFunction): string {
  let deltaSec = (Date.now() - date.getTime()) / 1000;

  if (isNaN(deltaSec)) {
    deltaSec = 0;
  }

  if (deltaSec < SEC_PER_MIN) {
    return t('seconds ago');
  } else if (deltaSec < SEC_PER_HOUR) {
    const count = Math.floor(deltaSec / SEC_PER_MIN);
    return t('{{ count }} minute ago', { count });
  } else if (deltaSec < SEC_PER_DAY) {
    const count = Math.floor(deltaSec / SEC_PER_HOUR);
    return t('{{ count }} hour ago', { count });
  } else if (deltaSec < SEC_PER_WEEK) {
    const count = Math.floor(deltaSec / SEC_PER_DAY);
    return t('{{ count }} day ago', { count });
  } else if (deltaSec < SEC_PER_MONTH) {
    const count = Math.floor(deltaSec / SEC_PER_WEEK);
    return t('{{ count }} week ago', { count });
  } else if (deltaSec < SEC_PER_YEAR) {
    const count = Math.floor(deltaSec / SEC_PER_MONTH);
    return t('{{ count }} month ago', { count });
  } else {
    const count = Math.floor(deltaSec / SEC_PER_YEAR);
    return t('{{ count }} year ago', { count });
  }
}

export default relativeTime;
