import af from "date-fns/esm/locale/af/index.js";
import ar_sa from "date-fns/esm/locale/ar-SA/index.js";
import bn from "date-fns/esm/locale/bn/index.js";
import de from "date-fns/esm/locale/de/index.js";
import el from "date-fns/esm/locale/el/index.js";
import en_ca from "date-fns/esm/locale/en-CA/index.js";
import en_gb from "date-fns/esm/locale/en-GB/index.js";
import en_us from "date-fns/esm/locale/en-US/index.js";
import eo from "date-fns/esm/locale/eo/index.js";
import es from "date-fns/esm/locale/es/index.js";
import et from "date-fns/esm/locale/et/index.js";
import fi from "date-fns/esm/locale/fi/index.js";
import fr from "date-fns/esm/locale/fr/index.js";
import gl from "date-fns/esm/locale/gl/index.js";
import he from "date-fns/esm/locale/he/index.js";
import hu from "date-fns/esm/locale/hu/index.js";
import id from "date-fns/esm/locale/id/index.js";
import is from "date-fns/esm/locale/is/index.js";
import it from "date-fns/esm/locale/it/index.js";
import lt from "date-fns/esm/locale/lt/index.js";
import nb from "date-fns/esm/locale/nb/index.js";
import nl from "date-fns/esm/locale/nl/index.js";
import pt from "date-fns/esm/locale/nl/index.js";
import pt_br from "date-fns/esm/locale/pt-BR/index.js";
import ro from "date-fns/esm/locale/ro/index.js";
import ru from "date-fns/esm/locale/ru/index.js";
import sv from "date-fns/esm/locale/sv/index.js";
import th from "date-fns/esm/locale/th/index.js";
import uk from "date-fns/esm/locale/uk/index.js";
import vi from "date-fns/esm/locale/vi/index.js";
import zh_cn from "date-fns/esm/locale/zh-CN/index.js";

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
