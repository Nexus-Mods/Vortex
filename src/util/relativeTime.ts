const SEC_PER_MIN = 60;
const SEC_PER_HOUR = SEC_PER_MIN * 60;
const SEC_PER_DAY = SEC_PER_HOUR * 24;
const SEC_PER_WEEK = SEC_PER_DAY * 7;
const SEC_PER_MONTH = SEC_PER_DAY * 30;
const SEC_PER_YEAR = SEC_PER_DAY * 365;

function relativeTime(date: Date, t: I18next.TranslationFunction): string {
  const deltaSec = (new Date().getTime() - date.getTime()) / 1000;
  if (deltaSec < SEC_PER_MIN) {
    return t('seconds ago');
  } else if (deltaSec < SEC_PER_HOUR) {
    const count = !isNaN(Math.floor(deltaSec / SEC_PER_MIN)) ?
      Math.floor(deltaSec / SEC_PER_MIN) : 0;
    return t('{{ count }} minute ago', { count });
  } else if (deltaSec < SEC_PER_DAY) {
    const count = !isNaN(Math.floor(deltaSec / SEC_PER_HOUR)) ?
      Math.floor(deltaSec / SEC_PER_HOUR) : 0;
    return t('{{ count }} hour ago', { count });
  } else if (deltaSec < SEC_PER_WEEK) {
    const count = !isNaN(Math.floor(deltaSec / SEC_PER_DAY)) ?
      Math.floor(deltaSec / SEC_PER_DAY) : 0;
    return t('{{ count }} day ago', { count });
  } else if (deltaSec < SEC_PER_MONTH) {
    const count = !isNaN(Math.floor(deltaSec / SEC_PER_WEEK)) ?
      Math.floor(deltaSec / SEC_PER_WEEK) : 0;
    return t('{{ count }} week ago', { count });
  } else if (deltaSec < SEC_PER_YEAR) {
    const count = !isNaN(Math.floor(deltaSec / SEC_PER_MONTH)) ?
      Math.floor(deltaSec / SEC_PER_MONTH) : 0;
    return t('{{ count }} month ago', { count });
  } else {
    const count = !isNaN(Math.floor(deltaSec / SEC_PER_YEAR)) ?
      Math.floor(deltaSec / SEC_PER_YEAR) : 0;
    return t('{{ count }} year ago', { count });
  }
}

export default relativeTime;
