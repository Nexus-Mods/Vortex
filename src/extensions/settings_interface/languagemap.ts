
/**
 * maps language codes to native and english name.
 * @author Phil Teare
 * based on data from https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
 */
const languageMap = {
  ab: {
    name: 'Abkhaz',
    nativeName: 'аҧсуа',
  },
  aa: {
    name: 'Afar',
    nativeName: 'Afaraf',
  },
  af: {
    name: 'Afrikaans',
    nativeName: 'Afrikaans',
  },
  ak: {
    name: 'Akan',
    nativeName: 'Akan',
  },
  sq: {
    name: 'Albanian',
    nativeName: 'Shqip',
  },
  am: {
    name: 'Amharic',
    nativeName: 'አማርኛ',
  },
  ar: {
    name: 'Arabic',
    nativeName: 'العربية',
  },
  an: {
    name: 'Aragonese',
    nativeName: 'Aragonés',
  },
  hy: {
    name: 'Armenian',
    nativeName: 'Հայերեն',
  },
  as: {
    name: 'Assamese',
    nativeName: 'অসমীয়া',
  },
  av: {
    name: 'Avaric',
    nativeName: 'авар мацӀ, магӀарул мацӀ',
  },
  ae: {
    name: 'Avestan',
    nativeName: 'avesta',
  },
  ay: {
    name: 'Aymara',
    nativeName: 'aymar aru',
  },
  az: {
    name: 'Azerbaijani',
    nativeName: 'azərbaycan dili',
  },
  bm: {
    name: 'Bambara',
    nativeName: 'bamanankan',
  },
  ba: {
    name: 'Bashkir',
    nativeName: 'башҡорт теле',
  },
  eu: {
    name: 'Basque',
    nativeName: 'euskara, euskera',
  },
  be: {
    name: 'Belarusian',
    nativeName: 'Беларуская',
  },
  bn: {
    name: 'Bengali',
    nativeName: 'বাংলা',
  },
  bh: {
    name: 'Bihari',
    nativeName: 'भोजपुरी',
  },
  bi: {
    name: 'Bislama',
    nativeName: 'Bislama',
  },
  bs: {
    name: 'Bosnian',
    nativeName: 'bosanski jezik',
  },
  br: {
    name: 'Breton',
    nativeName: 'brezhoneg',
  },
  bg: {
    name: 'Bulgarian',
    nativeName: 'български език',
  },
  my: {
    name: 'Burmese',
    nativeName: 'ဗမာစာ',
  },
  ca: {
    name: 'Catalan; Valencian',
    nativeName: 'Català',
  },
  ch: {
    name: 'Chamorro',
    nativeName: 'Chamoru',
  },
  ce: {
    name: 'Chechen',
    nativeName: 'нохчийн мотт',
  },
  ny: {
    name: 'Chichewa; Chewa; Nyanja',
    nativeName: 'chiCheŵa, chinyanja',
  },
  zh: {
    name: 'Chinese',
    nativeName: '中文 (Zhōngwén), 汉语, 漢語',
  },
  cv: {
    name: 'Chuvash',
    nativeName: 'чӑваш чӗлхи',
  },
  kw: {
    name: 'Cornish',
    nativeName: 'Kernewek',
  },
  co: {
    name: 'Corsican',
    nativeName: 'corsu, lingua corsa',
  },
  cr: {
    name: 'Cree',
    nativeName: 'ᓀᐦᐃᔭᐍᐏᐣ',
  },
  hr: {
    name: 'Croatian',
    nativeName: 'hrvatski',
  },
  cs: {
    name: 'Czech',
    nativeName: 'česky, čeština',
  },
  da: {
    name: 'Danish',
    nativeName: 'dansk',
  },
  dv: {
    name: 'Divehi; Dhivehi; Maldivian;',
    nativeName: 'ދިވެހި',
  },
  nl: {
    name: 'Dutch',
    nativeName: 'Nederlands, Vlaams',
  },
  en: {
    name: 'English',
    nativeName: 'English',
  },
  eo: {
    name: 'Esperanto',
    nativeName: 'Esperanto',
  },
  et: {
    name: 'Estonian',
    nativeName: 'eesti, eesti keel',
  },
  ee: {
    name: 'Ewe',
    nativeName: 'Eʋegbe',
  },
  fo: {
    name: 'Faroese',
    nativeName: 'føroyskt',
  },
  fj: {
    name: 'Fijian',
    nativeName: 'vosa Vakaviti',
  },
  fi: {
    name: 'Finnish',
    nativeName: 'suomi, suomen kieli',
  },
  fr: {
    name: 'French',
    nativeName: 'français, langue française',
  },
  ff: {
    name: 'Fula; Fulah; Pulaar; Pular',
    nativeName: 'Fulfulde, Pulaar, Pular',
  },
  gl: {
    name: 'Galician',
    nativeName: 'Galego',
  },
  ka: {
    name: 'Georgian',
    nativeName: 'ქართული',
  },
  de: {
    name: 'German',
    nativeName: 'Deutsch',
  },
  el: {
    name: 'Greek, Modern',
    nativeName: 'Ελληνικά',
  },
  gn: {
    name: 'Guaraní',
    nativeName: 'Avañeẽ',
  },
  gu: {
    name: 'Gujarati',
    nativeName: 'ગુજરાતી',
  },
  ht: {
    name: 'Haitian; Haitian Creole',
    nativeName: 'Kreyòl ayisyen',
  },
  ha: {
    name: 'Hausa',
    nativeName: 'Hausa, هَوُسَ',
  },
  he: {
    name: 'Hebrew (modern)',
    nativeName: 'עברית',
  },
  hz: {
    name: 'Herero',
    nativeName: 'Otjiherero',
  },
  hi: {
    name: 'Hindi',
    nativeName: 'हिन्दी, हिंदी',
  },
  ho: {
    name: 'Hiri Motu',
    nativeName: 'Hiri Motu',
  },
  hu: {
    name: 'Hungarian',
    nativeName: 'Magyar',
  },
  ia: {
    name: 'Interlingua',
    nativeName: 'Interlingua',
  },
  id: {
    name: 'Indonesian',
    nativeName: 'Bahasa Indonesia',
  },
  ie: {
    name: 'Interlingue',
    nativeName: 'Interlingue',
  },
  ga: {
    name: 'Irish',
    nativeName: 'Gaeilge',
  },
  ig: {
    name: 'Igbo',
    nativeName: 'Asụsụ Igbo',
  },
  ik: {
    name: 'Inupiaq',
    nativeName: 'Iñupiaq, Iñupiatun',
  },
  io: {
    name: 'Ido',
    nativeName: 'Ido',
  },
  is: {
    name: 'Icelandic',
    nativeName: 'Íslenska',
  },
  it: {
    name: 'Italian',
    nativeName: 'Italiano',
  },
  iu: {
    name: 'Inuktitut',
    nativeName: 'ᐃᓄᒃᑎᑐᑦ',
  },
  ja: {
    name: 'Japanese',
    nativeName: '日本語 (にほんご／にっぽんご)',
  },
  jv: {
    name: 'Javanese',
    nativeName: 'basa Jawa',
  },
  kl: {
    name: 'Kalaallisut, Greenlandic',
    nativeName: 'kalaallisut, kalaallit oqaasii',
  },
  kn: {
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
  },
  kr: {
    name: 'Kanuri',
    nativeName: 'Kanuri',
  },
  ks: {
    name: 'Kashmiri',
    nativeName: 'कश्मीरी, كشميري‎',
  },
  kk: {
    name: 'Kazakh',
    nativeName: 'Қазақ тілі',
  },
  km: {
    name: 'Khmer',
    nativeName: 'ភាសាខ្មែរ',
  },
  ki: {
    name: 'Kikuyu, Gikuyu',
    nativeName: 'Gĩkũyũ',
  },
  rw: {
    name: 'Kinyarwanda',
    nativeName: 'Ikinyarwanda',
  },
  ky: {
    name: 'Kirghiz, Kyrgyz',
    nativeName: 'кыргыз тили',
  },
  kv: {
    name: 'Komi',
    nativeName: 'коми кыв',
  },
  kg: {
    name: 'Kongo',
    nativeName: 'KiKongo',
  },
  ko: {
    name: 'Korean',
    nativeName: '한국어',
  },
  ku: {
    name: 'Kurdish',
    nativeName: 'Kurdî, كوردی‎',
  },
  kj: {
    name: 'Kwanyama, Kuanyama',
    nativeName: 'Kuanyama',
  },
  la: {
    name: 'Latin',
    nativeName: 'latine, lingua latina',
  },
  lb: {
    name: 'Luxembourgish, Letzeburgesch',
    nativeName: 'Lëtzebuergesch',
  },
  lg: {
    name: 'Luganda',
    nativeName: 'Luganda',
  },
  li: {
    name: 'Limburgish, Limburgan, Limburger',
    nativeName: 'Limburgs',
  },
  ln: {
    name: 'Lingala',
    nativeName: 'Lingála',
  },
  lo: {
    name: 'Lao',
    nativeName: 'ພາສາລາວ',
  },
  lt: {
    name: 'Lithuanian',
    nativeName: 'lietuvių kalba',
  },
  lu: {
    name: 'Luba-Katanga',
    nativeName: 'Luba-Katanga',
  },
  lv: {
    name: 'Latvian',
    nativeName: 'latviešu valoda',
  },
  gv: {
    name: 'Manx',
    nativeName: 'Gaelg, Gailck',
  },
  mk: {
    name: 'Macedonian',
    nativeName: 'македонски јазик',
  },
  mg: {
    name: 'Malagasy',
    nativeName: 'Malagasy fiteny',
  },
  ms: {
    name: 'Malay',
    nativeName: 'bahasa Melayu, بهاس ملايو‎',
  },
  ml: {
    name: 'Malayalam',
    nativeName: 'മലയാളം',
  },
  mt: {
    name: 'Maltese',
    nativeName: 'Malti',
  },
  mi: {
    name: 'Māori',
    nativeName: 'te reo Māori',
  },
  mr: {
    name: 'Marathi (Marāṭhī)',
    nativeName: 'मराठी',
  },
  mh: {
    name: 'Marshallese',
    nativeName: 'Kajin M̧ajeļ',
  },
  mn: {
    name: 'Mongolian',
    nativeName: 'монгол',
  },
  na: {
    name: 'Nauru',
    nativeName: 'Ekakairũ Naoero',
  },
  nv: {
    name: 'Navajo, Navaho',
    nativeName: 'Diné bizaad, Dinékʼehǰí',
  },
  nb: {
    name: 'Norwegian Bokmål',
    nativeName: 'Norsk bokmål',
  },
  nd: {
    name: 'North Ndebele',
    nativeName: 'isiNdebele',
  },
  ne: {
    name: 'Nepali',
    nativeName: 'नेपाली',
  },
  ng: {
    name: 'Ndonga',
    nativeName: 'Owambo',
  },
  nn: {
    name: 'Norwegian Nynorsk',
    nativeName: 'Norsk nynorsk',
  },
  no: {
    name: 'Norwegian',
    nativeName: 'Norsk',
  },
  ii: {
    name: 'Nuosu',
    nativeName: 'ꆈꌠ꒿ Nuosuhxop',
  },
  nr: {
    name: 'South Ndebele',
    nativeName: 'isiNdebele',
  },
  oc: {
    name: 'Occitan',
    nativeName: 'Occitan',
  },
  oj: {
    name: 'Ojibwe, Ojibwa',
    nativeName: 'ᐊᓂᔑᓈᐯᒧᐎᓐ',
  },
  cu: {
    name: 'Old Church Slavonic, Church Slavic, Church Slavonic, Old Bulgarian, Old Slavonic',
    nativeName: 'ѩзыкъ словѣньскъ',
  },
  om: {
    name: 'Oromo',
    nativeName: 'Afaan Oromoo',
  },
  or: {
    name: 'Oriya',
    nativeName: 'ଓଡ଼ିଆ',
  },
  os: {
    name: 'Ossetian, Ossetic',
    nativeName: 'ирон æвзаг',
  },
  pa: {
    name: 'Panjabi, Punjabi',
    nativeName: 'ਪੰਜਾਬੀ, پنجابی‎',
  },
  pi: {
    name: 'Pāli',
    nativeName: 'पाऴि',
  },
  fa: {
    name: 'Persian',
    nativeName: 'فارسی',
  },
  pl: {
    name: 'Polish',
    nativeName: 'polski',
  },
  ps: {
    name: 'Pashto, Pushto',
    nativeName: 'پښتو',
  },
  pt: {
    name: 'Portuguese',
    nativeName: 'Português',
  },
  qu: {
    name: 'Quechua',
    nativeName: 'Runa Simi, Kichwa',
  },
  rm: {
    name: 'Romansh',
    nativeName: 'rumantsch grischun',
  },
  rn: {
    name: 'Kirundi',
    nativeName: 'kiRundi',
  },
  ro: {
    name: 'Romanian, Moldavian, Moldovan',
    nativeName: 'română',
  },
  ru: {
    name: 'Russian',
    nativeName: 'русский язык',
  },
  sa: {
    name: 'Sanskrit (Saṁskṛta)',
    nativeName: 'संस्कृतम्',
  },
  sc: {
    name: 'Sardinian',
    nativeName: 'sardu',
  },
  sd: {
    name: 'Sindhi',
    nativeName: 'सिन्धी, سنڌي، سندھی‎',
  },
  se: {
    name: 'Northern Sami',
    nativeName: 'Davvisámegiella',
  },
  sm: {
    name: 'Samoan',
    nativeName: 'gagana faa Samoa',
  },
  sg: {
    name: 'Sango',
    nativeName: 'yângâ tî sängö',
  },
  sr: {
    name: 'Serbian',
    nativeName: 'српски језик',
  },
  gd: {
    name: 'Scottish Gaelic; Gaelic',
    nativeName: 'Gàidhlig',
  },
  sn: {
    name: 'Shona',
    nativeName: 'chiShona',
  },
  si: {
    name: 'Sinhala, Sinhalese',
    nativeName: 'සිංහල',
  },
  sk: {
    name: 'Slovak',
    nativeName: 'slovenčina',
  },
  sl: {
    name: 'Slovene',
    nativeName: 'slovenščina',
  },
  so: {
    name: 'Somali',
    nativeName: 'Soomaaliga, af Soomaali',
  },
  st: {
    name: 'Southern Sotho',
    nativeName: 'Sesotho',
  },
  es: {
    name: 'Spanish; Castilian',
    nativeName: 'español, castellano',
  },
  su: {
    name: 'Sundanese',
    nativeName: 'Basa Sunda',
  },
  sw: {
    name: 'Swahili',
    nativeName: 'Kiswahili',
  },
  ss: {
    name: 'Swati',
    nativeName: 'SiSwati',
  },
  sv: {
    name: 'Swedish',
    nativeName: 'svenska',
  },
  ta: {
    name: 'Tamil',
    nativeName: 'தமிழ்',
  },
  te: {
    name: 'Telugu',
    nativeName: 'తెలుగు',
  },
  tg: {
    name: 'Tajik',
    nativeName: 'тоҷикӣ, toğikī, تاجیکی‎',
  },
  th: {
    name: 'Thai',
    nativeName: 'ไทย',
  },
  ti: {
    name: 'Tigrinya',
    nativeName: 'ትግርኛ',
  },
  bo: {
    name: 'Tibetan Standard, Tibetan, Central',
    nativeName: 'བོད་ཡིག',
  },
  tk: {
    name: 'Turkmen',
    nativeName: 'Türkmen, Түркмен',
  },
  tl: {
    name: 'Tagalog',
    nativeName: 'Wikang Tagalog',
  },
  tn: {
    name: 'Tswana',
    nativeName: 'Setswana',
  },
  to: {
    name: 'Tonga (Tonga Islands)',
    nativeName: 'faka Tonga',
  },
  tr: {
    name: 'Turkish',
    nativeName: 'Türkçe',
  },
  ts: {
    name: 'Tsonga',
    nativeName: 'Xitsonga',
  },
  tt: {
    name: 'Tatar',
    nativeName: 'татарча, tatarça, تاتارچا‎',
  },
  tw: {
    name: 'Twi',
    nativeName: 'Twi',
  },
  ty: {
    name: 'Tahitian',
    nativeName: 'Reo Tahiti',
  },
  ug: {
    name: 'Uighur, Uyghur',
    nativeName: 'Uyƣurqə, ئۇيغۇرچە‎',
  },
  uk: {
    name: 'Ukrainian',
    nativeName: 'українська',
  },
  ur: {
    name: 'Urdu',
    nativeName: 'اردو',
  },
  uz: {
    name: 'Uzbek',
    nativeName: 'zbek, Ўзбек, أۇزبېك‎',
  },
  ve: {
    name: 'Venda',
    nativeName: 'Tshivenḓa',
  },
  vi: {
    name: 'Vietnamese',
    nativeName: 'Tiếng Việt',
  },
  vo: {
    name: 'Volapük',
    nativeName: 'Volapük',
  },
  wa: {
    name: 'Walloon',
    nativeName: 'Walon',
  },
  cy: {
    name: 'Welsh',
    nativeName: 'Cymraeg',
  },
  wo: {
    name: 'Wolof',
    nativeName: 'Wollof',
  },
  fy: {
    name: 'Western Frisian',
    nativeName: 'Frysk',
  },
  xh: {
    name: 'Xhosa',
    nativeName: 'isiXhosa',
  },
  yi: {
    name: 'Yiddish',
    nativeName: 'ייִדיש',
  },
  yo: {
    name: 'Yoruba',
    nativeName: 'Yorùbá',
  },
  za: {
    name: 'Zhuang, Chuang',
    nativeName: 'Saɯ cueŋƅ, Saw cuengh',
  },
};

const countryMap = {
  AD: {
    name: 'Andorra',
    nativeName: 'Andorra',
  },
  AE: {
    name: 'United Arab Emirates',
    nativeName: 'دولة الإمارات العربية المتحدة',
  },
  AF: {
    name: 'Afghanistan',
    nativeName: 'افغانستان',
  },
  AG: {
    name: 'Antigua and Barbuda',
    nativeName: 'Antigua and Barbuda',
  },
  AI: {
    name: 'Anguilla',
    nativeName: 'Anguilla',
  },
  AL: {
    name: 'Albania',
    nativeName: 'Shqipëria',
  },
  AM: {
    name: 'Armenia',
    nativeName: 'Հայաստան',
  },
  AO: {
    name: 'Angola',
    nativeName: 'Angola',
  },
  AQ: {
    name: 'Antarctica',
    nativeName: 'Antarctica',
  },
  AR: {
    name: 'Argentina',
    nativeName: 'Argentina',
  },
  AS: {
    name: 'American Samoa',
    nativeName: 'American Samoa',
  },
  AT: {
    name: 'Austria',
    nativeName: 'Österreich',
  },
  AU: {
    name: 'Australia',
    nativeName: 'Australia',
  },
  AW: {
    name: 'Aruba',
    nativeName: 'Aruba',
  },
  AX: {
    name: 'Åland',
    nativeName: 'Åland',
  },
  AZ: {
    name: 'Azerbaijan',
    nativeName: 'Azərbaycan',
  },
  BA: {
    name: 'Bosnia and Herzegovina',
    nativeName: 'Bosna i Hercegovina',
  },
  BB: {
    name: 'Barbados',
    nativeName: 'Barbados',
  },
  BD: {
    name: 'Bangladesh',
    nativeName: 'Bangladesh',
  },
  BE: {
    name: 'Belgium',
    nativeName: 'België',
  },
  BF: {
    name: 'Burkina Faso',
    nativeName: 'Burkina Faso',
  },
  BG: {
    name: 'Bulgaria',
    nativeName: 'България',
  },
  BH: {
    name: 'Bahrain',
    nativeName: '‏البحرين',
  },
  BI: {
    name: 'Burundi',
    nativeName: 'Burundi',
  },
  BJ: {
    name: 'Benin',
    nativeName: 'Bénin',
  },
  BL: {
    name: 'Saint Barthélemy',
    nativeName: 'Saint-Barthélemy',
  },
  BM: {
    name: 'Bermuda',
    nativeName: 'Bermuda',
  },
  BN: {
    name: 'Brunei',
    nativeName: 'Negara Brunei Darussalam',
  },
  BO: {
    name: 'Bolivia',
    nativeName: 'Bolivia',
  },
  BQ: {
    name: 'Bonaire',
    nativeName: 'Bonaire',
  },
  BR: {
    name: 'Brazil',
    nativeName: 'Brasil',
  },
  BS: {
    name: 'Bahamas',
    nativeName: 'Bahamas',
  },
  BT: {
    name: 'Bhutan',
    nativeName: 'ʼbrug-yul',
  },
  BV: {
    name: 'Bouvet Island',
    nativeName: 'Bouvetøya',
  },
  BW: {
    name: 'Botswana',
    nativeName: 'Botswana',
  },
  BY: {
    name: 'Belarus',
    nativeName: 'Белару́сь',
  },
  BZ: {
    name: 'Belize',
    nativeName: 'Belize',
  },
  CA: {
    name: 'Canada',
    nativeName: 'Canada',
  },
  CC: {
    name: 'Cocos [Keeling] Islands',
    nativeName: 'Cocos (Keeling) Islands',
  },
  CD: {
    name: 'Democratic Republic of the Congo',
    nativeName: 'République démocratique du Congo',
  },
  CF: {
    name: 'Central African Republic',
    nativeName: 'Ködörösêse tî Bêafrîka',
  },
  CG: {
    name: 'Republic of the Congo',
    nativeName: 'République du Congo',
  },
  CH: {
    name: 'Switzerland',
    nativeName: 'Schweiz',
  },
  CI: {
    name: 'Ivory Coast',
    nativeName: "Côte d'Ivoire",
  },
  CK: {
    name: 'Cook Islands',
    nativeName: 'Cook Islands',
  },
  CL: {
    name: 'Chile',
    nativeName: 'Chile',
  },
  CM: {
    name: 'Cameroon',
    nativeName: 'Cameroon',
  },
  CN: {
    name: 'China',
    nativeName: '中国',
  },
  CO: {
    name: 'Colombia',
    nativeName: 'Colombia',
  },
  CR: {
    name: 'Costa Rica',
    nativeName: 'Costa Rica',
  },
  CU: {
    name: 'Cuba',
    nativeName: 'Cuba',
  },
  CV: {
    name: 'Cape Verde',
    nativeName: 'Cabo Verde',
  },
  CW: {
    name: 'Curacao',
    nativeName: 'Curaçao',
  },
  CX: {
    name: 'Christmas Island',
    nativeName: 'Christmas Island',
  },
  CY: {
    name: 'Cyprus',
    nativeName: 'Κύπρος',
  },
  CZ: {
    name: 'Czech Republic',
    nativeName: 'Česká republika',
  },
  DE: {
    name: 'Germany',
    nativeName: 'Deutschland',
  },
  DJ: {
    name: 'Djibouti',
    nativeName: 'Djibouti',
  },
  DK: {
    name: 'Denmark',
    nativeName: 'Danmark',
  },
  DM: {
    name: 'Dominica',
    nativeName: 'Dominica',
  },
  DO: {
    name: 'Dominican Republic',
    nativeName: 'República Dominicana',
  },
  DZ: {
    name: 'Algeria',
    nativeName: 'الجزائر',
  },
  EC: {
    name: 'Ecuador',
    nativeName: 'Ecuador',
  },
  EE: {
    name: 'Estonia',
    nativeName: 'Eesti',
  },
  EG: {
    name: 'Egypt',
    nativeName: 'مصر‎',
  },
  EH: {
    name: 'Western Sahara',
    nativeName: 'الصحراء الغربية',
  },
  ER: {
    name: 'Eritrea',
    nativeName: 'ኤርትራ',
  },
  ES: {
    name: 'Spain',
    nativeName: 'España',
  },
  ET: {
    name: 'Ethiopia',
    nativeName: 'ኢትዮጵያ',
  },
  FI: {
    name: 'Finland',
    nativeName: 'Suomi',
  },
  FJ: {
    name: 'Fiji',
    nativeName: 'Fiji',
  },
  FK: {
    name: 'Falkland Islands',
    nativeName: 'Falkland Islands',
  },
  FM: {
    name: 'Micronesia',
    nativeName: 'Micronesia',
  },
  FO: {
    name: 'Faroe Islands',
    nativeName: 'Føroyar',
  },
  FR: {
    name: 'France',
    nativeName: 'France',
  },
  GA: {
    name: 'Gabon',
    nativeName: 'Gabon',
  },
  GB: {
    name: 'United Kingdom',
    nativeName: 'United Kingdom',
  },
  GD: {
    name: 'Grenada',
    nativeName: 'Grenada',
  },
  GE: {
    name: 'Georgia',
    nativeName: 'საქართველო',
  },
  GF: {
    name: 'French Guiana',
    nativeName: 'Guyane française',
  },
  GG: {
    name: 'Guernsey',
    nativeName: 'Guernsey',
  },
  GH: {
    name: 'Ghana',
    nativeName: 'Ghana',
  },
  GI: {
    name: 'Gibraltar',
    nativeName: 'Gibraltar',
  },
  GL: {
    name: 'Greenland',
    nativeName: 'Kalaallit Nunaat',
  },
  GM: {
    name: 'Gambia',
    nativeName: 'Gambia',
  },
  GN: {
    name: 'Guinea',
    nativeName: 'Guinée',
  },
  GP: {
    name: 'Guadeloupe',
    nativeName: 'Guadeloupe',
  },
  GQ: {
    name: 'Equatorial Guinea',
    nativeName: 'Guinea Ecuatorial',
  },
  GR: {
    name: 'Greece',
    nativeName: 'Ελλάδα',
  },
  GS: {
    name: 'South Georgia and the South Sandwich Islands',
    nativeName: 'South Georgia',
  },
  GT: {
    name: 'Guatemala',
    nativeName: 'Guatemala',
  },
  GU: {
    name: 'Guam',
    nativeName: 'Guam',
  },
  GW: {
    name: 'Guinea-Bissau',
    nativeName: 'Guiné-Bissau',
  },
  GY: {
    name: 'Guyana',
    nativeName: 'Guyana',
  },
  HK: {
    name: 'Hong Kong',
    nativeName: '香港',
  },
  HM: {
    name: 'Heard Island and McDonald Islands',
    nativeName: 'Heard Island and McDonald Islands',
  },
  HN: {
    name: 'Honduras',
    nativeName: 'Honduras',
  },
  HR: {
    name: 'Croatia',
    nativeName: 'Hrvatska',
  },
  HT: {
    name: 'Haiti',
    nativeName: 'Haïti',
  },
  HU: {
    name: 'Hungary',
    nativeName: 'Magyarország',
  },
  ID: {
    name: 'Indonesia',
    nativeName: 'Indonesia',
  },
  IE: {
    name: 'Ireland',
    nativeName: 'Éire',
  },
  IL: {
    name: 'Israel',
    nativeName: 'יִשְׂרָאֵל',
  },
  IM: {
    name: 'Isle of Man',
    nativeName: 'Isle of Man',
  },
  IN: {
    name: 'India',
    nativeName: 'भारत',
  },
  IO: {
    name: 'British Indian Ocean Territory',
    nativeName: 'British Indian Ocean Territory',
  },
  IQ: {
    name: 'Iraq',
    nativeName: 'العراق',
  },
  IR: {
    name: 'Iran',
    nativeName: 'ایران',
  },
  IS: {
    name: 'Iceland',
    nativeName: 'Ísland',
  },
  IT: {
    name: 'Italy',
    nativeName: 'Italia',
  },
  JE: {
    name: 'Jersey',
    nativeName: 'Jersey',
  },
  JM: {
    name: 'Jamaica',
    nativeName: 'Jamaica',
  },
  JO: {
    name: 'Jordan',
    nativeName: 'الأردن',
  },
  JP: {
    name: 'Japan',
    nativeName: '日本',
  },
  KE: {
    name: 'Kenya',
    nativeName: 'Kenya',
  },
  KG: {
    name: 'Kyrgyzstan',
    nativeName: 'Кыргызстан',
  },
  KH: {
    name: 'Cambodia',
    nativeName: 'Kâmpŭchéa',
  },
  KI: {
    name: 'Kiribati',
    nativeName: 'Kiribati',
  },
  KM: {
    name: 'Comoros',
    nativeName: 'Komori',
  },
  KN: {
    name: 'Saint Kitts and Nevis',
    nativeName: 'Saint Kitts and Nevis',
  },
  KP: {
    name: 'North Korea',
    nativeName: '북한',
  },
  KR: {
    name: 'South Korea',
    nativeName: '대한민국',
  },
  KW: {
    name: 'Kuwait',
    nativeName: 'الكويت',
  },
  KY: {
    name: 'Cayman Islands',
    nativeName: 'Cayman Islands',
  },
  KZ: {
    name: 'Kazakhstan',
    nativeName: 'Қазақстан',
  },
  LA: {
    name: 'Laos',
    nativeName: 'ສປປລາວ',
  },
  LB: {
    name: 'Lebanon',
    nativeName: 'لبنان',
  },
  LC: {
    name: 'Saint Lucia',
    nativeName: 'Saint Lucia',
  },
  LI: {
    name: 'Liechtenstein',
    nativeName: 'Liechtenstein',
  },
  LK: {
    name: 'Sri Lanka',
    nativeName: 'śrī laṃkāva',
  },
  LR: {
    name: 'Liberia',
    nativeName: 'Liberia',
  },
  LS: {
    name: 'Lesotho',
    nativeName: 'Lesotho',
  },
  LT: {
    name: 'Lithuania',
    nativeName: 'Lietuva',
  },
  LU: {
    name: 'Luxembourg',
    nativeName: 'Luxembourg',
  },
  LV: {
    name: 'Latvia',
    nativeName: 'Latvija',
  },
  LY: {
    name: 'Libya',
    nativeName: '‏ليبيا',
  },
  MA: {
    name: 'Morocco',
    nativeName: 'المغرب',
  },
  MC: {
    name: 'Monaco',
    nativeName: 'Monaco',
  },
  MD: {
    name: 'Moldova',
    nativeName: 'Moldova',
  },
  ME: {
    name: 'Montenegro',
    nativeName: 'Црна Гора',
  },
  MF: {
    name: 'Saint Martin',
    nativeName: 'Saint-Martin',
  },
  MG: {
    name: 'Madagascar',
    nativeName: 'Madagasikara',
  },
  MH: {
    name: 'Marshall Islands',
    nativeName: 'M̧ajeļ',
  },
  MK: {
    name: 'Macedonia',
    nativeName: 'Македонија',
  },
  ML: {
    name: 'Mali',
    nativeName: 'Mali',
  },
  MM: {
    name: 'Myanmar [Burma]',
    nativeName: 'Myanma',
  },
  MN: {
    name: 'Mongolia',
    nativeName: 'Монгол улс',
  },
  MO: {
    name: 'Macao',
    nativeName: '澳門',
  },
  MP: {
    name: 'Northern Mariana Islands',
    nativeName: 'Northern Mariana Islands',
  },
  MQ: {
    name: 'Martinique',
    nativeName: 'Martinique',
  },
  MR: {
    name: 'Mauritania',
    nativeName: 'موريتانيا',
  },
  MS: {
    name: 'Montserrat',
    nativeName: 'Montserrat',
  },
  MT: {
    name: 'Malta',
    nativeName: 'Malta',
  },
  MU: {
    name: 'Mauritius',
    nativeName: 'Maurice',
  },
  MV: {
    name: 'Maldives',
    nativeName: 'Maldives',
  },
  MW: {
    name: 'Malawi',
    nativeName: 'Malawi',
  },
  MX: {
    name: 'Mexico',
    nativeName: 'México',
  },
  MY: {
    name: 'Malaysia',
    nativeName: 'Malaysia',
  },
  MZ: {
    name: 'Mozambique',
    nativeName: 'Moçambique',
  },
  NA: {
    name: 'Namibia',
    nativeName: 'Namibia',
  },
  NC: {
    name: 'New Caledonia',
    nativeName: 'Nouvelle-Calédonie',
  },
  NE: {
    name: 'Niger',
    nativeName: 'Niger',
  },
  NF: {
    name: 'Norfolk Island',
    nativeName: 'Norfolk Island',
  },
  NG: {
    name: 'Nigeria',
    nativeName: 'Nigeria',
  },
  NI: {
    name: 'Nicaragua',
    nativeName: 'Nicaragua',
  },
  NL: {
    name: 'Netherlands',
    nativeName: 'Nederland',
  },
  NO: {
    name: 'Norway',
    nativeName: 'Norge',
  },
  NP: {
    name: 'Nepal',
    nativeName: 'नपल',
  },
  NR: {
    name: 'Nauru',
    nativeName: 'Nauru',
  },
  NU: {
    name: 'Niue',
    nativeName: 'Niuē',
  },
  NZ: {
    name: 'New Zealand',
    nativeName: 'New Zealand',
  },
  OM: {
    name: 'Oman',
    nativeName: 'عمان',
  },
  PA: {
    name: 'Panama',
    nativeName: 'Panamá',
  },
  PE: {
    name: 'Peru',
    nativeName: 'Perú',
  },
  PF: {
    name: 'French Polynesia',
    nativeName: 'Polynésie française',
  },
  PG: {
    name: 'Papua New Guinea',
    nativeName: 'Papua Niugini',
  },
  PH: {
    name: 'Philippines',
    nativeName: 'Pilipinas',
  },
  PK: {
    name: 'Pakistan',
    nativeName: 'Pakistan',
  },
  PL: {
    name: 'Poland',
    nativeName: 'Polska',
  },
  PM: {
    name: 'Saint Pierre and Miquelon',
    nativeName: 'Saint-Pierre-et-Miquelon',
  },
  PN: {
    name: 'Pitcairn Islands',
    nativeName: 'Pitcairn Islands',
  },
  PR: {
    name: 'Puerto Rico',
    nativeName: 'Puerto Rico',
  },
  PS: {
    name: 'Palestine',
    nativeName: 'فلسطين',
  },
  PT: {
    name: 'Portugal',
    nativeName: 'Portugal',
  },
  PW: {
    name: 'Palau',
    nativeName: 'Palau',
  },
  PY: {
    name: 'Paraguay',
    nativeName: 'Paraguay',
  },
  QA: {
    name: 'Qatar',
    nativeName: 'قطر',
  },
  RE: {
    name: 'Réunion',
    nativeName: 'La Réunion',
  },
  RO: {
    name: 'Romania',
    nativeName: 'România',
  },
  RS: {
    name: 'Serbia',
    nativeName: 'Србија',
  },
  RU: {
    name: 'Russia',
    nativeName: 'Россия',
  },
  RW: {
    name: 'Rwanda',
    nativeName: 'Rwanda',
  },
  SA: {
    name: 'Saudi Arabia',
    nativeName: 'العربية السعودية',
  },
  SB: {
    name: 'Solomon Islands',
    nativeName: 'Solomon Islands',
  },
  SC: {
    name: 'Seychelles',
    nativeName: 'Seychelles',
  },
  SD: {
    name: 'Sudan',
    nativeName: 'السودان',
  },
  SE: {
    name: 'Sweden',
    nativeName: 'Sverige',
  },
  SG: {
    name: 'Singapore',
    nativeName: 'Singapore',
  },
  SH: {
    name: 'Saint Helena',
    nativeName: 'Saint Helena',
  },
  SI: {
    name: 'Slovenia',
    nativeName: 'Slovenija',
  },
  SJ: {
    name: 'Svalbard and Jan Mayen',
    nativeName: 'Svalbard og Jan Mayen',
  },
  SK: {
    name: 'Slovakia',
    nativeName: 'Slovensko',
  },
  SL: {
    name: 'Sierra Leone',
    nativeName: 'Sierra Leone',
  },
  SM: {
    name: 'San Marino',
    nativeName: 'San Marino',
  },
  SN: {
    name: 'Senegal',
    nativeName: 'Sénégal',
  },
  SO: {
    name: 'Somalia',
    nativeName: 'Soomaaliya',
  },
  SR: {
    name: 'Suriname',
    nativeName: 'Suriname',
  },
  SS: {
    name: 'South Sudan',
    nativeName: 'South Sudan',
  },
  ST: {
    name: 'São Tomé and Príncipe',
    nativeName: 'São Tomé e Príncipe',
  },
  SV: {
    name: 'El Salvador',
    nativeName: 'El Salvador',
  },
  SX: {
    name: 'Sint Maarten',
    nativeName: 'Sint Maarten',
  },
  SY: {
    name: 'Syria',
    nativeName: 'سوريا',
  },
  SZ: {
    name: 'Swaziland',
    nativeName: 'Swaziland',
  },
  TC: {
    name: 'Turks and Caicos Islands',
    nativeName: 'Turks and Caicos Islands',
  },
  TD: {
    name: 'Chad',
    nativeName: 'Tchad',
  },
  TF: {
    name: 'French Southern Territories',
    nativeName: 'Territoire des Terres australes et antarctiques fr',
  },
  TG: {
    name: 'Togo',
    nativeName: 'Togo',
  },
  TH: {
    name: 'Thailand',
    nativeName: 'ประเทศไทย',
  },
  TJ: {
    name: 'Tajikistan',
    nativeName: 'Тоҷикистон',
  },
  TK: {
    name: 'Tokelau',
    nativeName: 'Tokelau',
  },
  TL: {
    name: 'East Timor',
    nativeName: 'Timor-Leste',
  },
  TM: {
    name: 'Turkmenistan',
    nativeName: 'Türkmenistan',
  },
  TN: {
    name: 'Tunisia',
    nativeName: 'تونس',
  },
  TO: {
    name: 'Tonga',
    nativeName: 'Tonga',
  },
  TR: {
    name: 'Turkey',
    nativeName: 'Türkiye',
  },
  TT: {
    name: 'Trinidad and Tobago',
    nativeName: 'Trinidad and Tobago',
  },
  TV: {
    name: 'Tuvalu',
    nativeName: 'Tuvalu',
  },
  TW: {
    name: 'Taiwan',
    nativeName: '臺灣',
  },
  TZ: {
    name: 'Tanzania',
    nativeName: 'Tanzania',
  },
  UA: {
    name: 'Ukraine',
    nativeName: 'Україна',
  },
  UG: {
    name: 'Uganda',
    nativeName: 'Uganda',
  },
  UM: {
    name: 'U.S. Minor Outlying Islands',
    nativeName: 'United States Minor Outlying Islands',
  },
  US: {
    name: 'United States',
    nativeName: 'United States',
  },
  UY: {
    name: 'Uruguay',
    nativeName: 'Uruguay',
  },
  UZ: {
    name: 'Uzbekistan',
    nativeName: 'O‘zbekiston',
  },
  VA: {
    name: 'Vatican City',
    nativeName: 'Vaticano',
  },
  VC: {
    name: 'Saint Vincent and the Grenadines',
    nativeName: 'Saint Vincent and the Grenadines',
  },
  VE: {
    name: 'Venezuela',
    nativeName: 'Venezuela',
  },
  VG: {
    name: 'British Virgin Islands',
    nativeName: 'British Virgin Islands',
  },
  VI: {
    name: 'U.S. Virgin Islands',
    nativeName: 'United States Virgin Islands',
  },
  VN: {
    name: 'Vietnam',
    nativeName: 'Việt Nam',
  },
  VU: {
    name: 'Vanuatu',
    nativeName: 'Vanuatu',
  },
  WF: {
    name: 'Wallis and Futuna',
    nativeName: 'Wallis et Futuna',
  },
  WS: {
    name: 'Samoa',
    nativeName: 'Samoa',
  },
  XK: {
    name: 'Kosovo',
    nativeName: 'Republika e Kosovës',
  },
  YE: {
    name: 'Yemen',
    nativeName: 'اليَمَن',
  },
  YT: {
    name: 'Mayotte',
    nativeName: 'Mayotte',
  },
  ZA: {
    name: 'South Africa',
    nativeName: 'South Africa',
  },
  ZM: {
    name: 'Zambia',
    nativeName: 'Zambia',
  },
  ZW: {
    name: 'Zimbabwe',
    nativeName: 'Zimbabwe',
  },
};

export function languageExists(code: string): boolean {
  return (code !== undefined) && (languageMap[code] !== undefined);
}

export function countryExists(code: string): boolean {
  return (code !== undefined) && (countryMap[code] !== undefined);
}

export function nativeLanguageName(code: string): string {
  const language = languageMap[code];
  if (language === undefined) {
    return code;
  } else {
    return languageMap[code].nativeName;
  }
}

export function nativeCountryName(code: string): string {
  const country = countryMap[code];
  if (country === undefined) {
    return code;
  } else {
    return country.nativeName;
  }
}
