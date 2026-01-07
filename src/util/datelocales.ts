import { af, arSA as ar_sa, bn, de, el, enCA as en_ca, enGB as en_gb, enUS as en_us, eo, es, et, fi, fr, gl, he, hu, id, is, it, lt, nb, nl, pt, ptBR as pt_br, ro, ru, sv, th, uk, vi, zhCN as zh_cn } from "date-fns/locale";

const langMap = {
  af,
  ar_sa,
  bn,
  de,
  el,
  en_ca,
  en_gb,
  en_us,
  eo,
  es,
  et,
  fi,
  fr,
  gl,
  he,
  hu,
  id,
  is,
  it,
  lt,
  nb,
  nl,
  pt,
  pt_br,
  ro,
  ru,
  sv,
  th,
  uk,
  vi,
  zh_cn,

  ar: ar_sa,
  en: en_us,
  zh: zh_cn,
};

export function getLocale(langCode: string): Locale | undefined {
  const code = langCode.split("-").map((k) => k.toLowerCase());
  if (code.length > 1 && langMap[`${code[0]}_${code[1]}`] !== undefined) {
    return langMap[`${code[0]}_${code[1]}`];
  } else if (code.length >= 1 && langMap[code[0]] !== undefined) {
    return langMap[code[0]];
  } else {
    return langMap["en"];
  }
}

const sampleDate1 = new Date("12/31/2019");
const sampleDate2 = new Date("05/31/2019");

export function getDateFormat(langCode: string): string {
  const loc = getLocale(langCode);
  if (loc !== undefined) {
    return loc.formatLong.date({ width: "short" });
  }

  // if date-fns doesn't know the language code, try a fallback by parsing
  // the output of toLocaleDateString. Not sure why javascript doesn't just provide
  // an api to get at that format string but whatever...

  // instead of bringing our own table of formats, lets just deduce it from the
  // js date library
  const formatted = sampleDate1.toLocaleDateString(langCode);
  if (formatted.indexOf("2019") === -1) {
    // this function will fail for any language not using latin characters, use
    // ISO format until someone implements the proper format for this language
    return "yyyy-MM-dd";
  }

  const formatted2 = sampleDate2.toLocaleString(langCode);
  const pad = formatted2.indexOf("05") !== -1;

  return formatted
    .replace("12", pad ? "MM" : "M")
    .replace("31", pad ? "dd" : "d")
    .replace("2019", "yyyy");
}
