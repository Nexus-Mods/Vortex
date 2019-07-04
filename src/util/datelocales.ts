
import * as af from 'date-fns/locale/af';
import * as ar_sa from 'date-fns/locale/ar-SA';
import * as bn from 'date-fns/locale/bn';
import * as de from 'date-fns/locale/de';
import * as el from 'date-fns/locale/el';
import * as en_ca from 'date-fns/locale/en-CA';
import * as en_gb from 'date-fns/locale/en-GB';
import * as en_us from 'date-fns/locale/en-US';
import * as eo from 'date-fns/locale/eo';
import * as es from 'date-fns/locale/es';
import * as et from 'date-fns/locale/et';
import * as fi from 'date-fns/locale/fi';
import * as fr from 'date-fns/locale/fr';
import * as gl from 'date-fns/locale/gl';
import * as he from 'date-fns/locale/he';
import * as hu from 'date-fns/locale/hu';
import * as id from 'date-fns/locale/id';
import * as is from 'date-fns/locale/is';
import * as it from 'date-fns/locale/it';
import * as lt from 'date-fns/locale/lt';
import * as nb from 'date-fns/locale/nb';
import * as nl from 'date-fns/locale/nl';
import * as pt from 'date-fns/locale/pt';
import * as pt_br from 'date-fns/locale/pt-BR';
import * as ro from 'date-fns/locale/ro';
import * as ru from 'date-fns/locale/ru';
import * as sv from 'date-fns/locale/sv';
import * as th from 'date-fns/locale/th';
import * as uk from 'date-fns/locale/uk';
import * as vi from 'date-fns/locale/vi';
import * as zh_cn from 'date-fns/locale/zh-CN';

const langMap = {
  af, ar_sa, bn, de, el, en_ca, en_gb, en_us,
  eo, es, et, fi, fr, gl, he, hu, id, is, it, lt,
  nb, nl, pt, pt_br, ro, ru, sv, th, uk, vi,
  zh_cn,

  ar: ar_sa,
  en: en_us,
  zh: zh_cn,
};

export function getLocale(langCode: string) {
  const code = langCode.split('-').map(k => k.toLowerCase());
  if ((code.length > 1) && (langMap[`${code[0]}_${code[1]}`] !== undefined)) {
    return langMap[`${code[0]}_${code[1]}`];
  } else if ((code.length >= 1) && (langMap[code[0]] !== undefined)) {
    return langMap[code[0]];
  } else {
    return langMap['en'];
  }
}

const sampleDate1 = new Date('12/31/2019');
const sampleDate2 = new Date('05/31/2019');

export function getDateFormat(langCode: string) {
  const loc = getLocale(langCode);
  if (loc !== undefined) {
    return loc.formatLong.date({ width: 'short' });
  }

  // if date-fns doesn't know the language code, try a fallback by parsing
  // the output of toLocaleDateString. Not sure why javascript doesn't just provide
  // an api to get at that format string but whatever...

  // instead of bringing our own table of formats, lets just deduce it from the
  // js date library
  const formatted = sampleDate1.toLocaleDateString(langCode);
  if (formatted.indexOf('2019') === -1) {
    // this function will fail for any language not using latin characters, use
    // ISO format until someone implements the proper format for this language
    return 'yyyy-MM-dd';
  }

  const formatted2 = sampleDate2.toLocaleString(langCode);
  const pad = formatted2.indexOf('05') !== -1;

  return formatted
    .replace('12', pad ? 'MM' : 'M')
    .replace('31', pad ? 'dd' : 'd')
    .replace('2019', 'yyyy');
}
