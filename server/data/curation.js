/**
 * Separates places a tourist would visit from administrative geography.
 *
 * Crawling Wikipedia's Jharkhand category tree deeply enough to reach every
 * waterfall and temple also drags in every community development block, census
 * village, assembly constituency and industrial area in the state. Those pages
 * satisfy the same shape checks (they have a summary and a district) but nobody
 * is planning a trip to "Bagodar-Saria subdivision".
 */

/** Titles that are administrative or institutional, never a destination. */
const REJECT_TITLE_PATTERNS = [
  /\bblock\b/i,
  /community development/i,
  /\bsubdivision\b/i,
  /assembly constituency/i,
  /lok sabha/i,
  /\bconstituency\b/i,
  /industrial area/i,
  /\bairport\b|\bairfield\b|\bairstrip\b/i,
  /\bschool\b|\bcollege\b|\buniversity\b|\binstitute\b|\bpolytechnic\b/i,
  /\bstadium\b|sports complex/i,
  /railway station|\bjunction\b/i,
  /thermal power|power station|power plant|\bcolliery\b|\bcoalfield\b/i,
  /\bhospital\b|medical college/i,
  /\bcensus\b|\bpanchayat\b|\btehsil\b|\bmunicipal/i,
  /\bdistrict\b$/i,
  /\bmine\b|\bmines\b/i,
  // Events, not places. A festival belongs on a calendar, not a map.
  /\bfestival\b|\bmela\b|\bjatra\b|\bparva\b|\bpuja\b$/i,
];

/**
 * Words that mark an untyped page as somewhere worth visiting. Applied only to
 * the `other`/`city` buckets, where the type classifier found no signal.
 */
const TOURIST_SIGNALS = /tourist|tourism|pilgrim|shrine|devotee|sightseeing|picnic|scenic|heritage|sanctuary|festival|\bfair\b|\bmela\b|attraction|visitors|excursion|resort|hill station|archaeolog|ancient|historic/i;

/** Types that are self-evidently places to visit. */
const TOURISTIC_TYPES = new Set([
  'waterfall', 'temple', 'dam', 'park', 'wildlife',
  'hill', 'lake', 'fort', 'museum', 'heritage',
]);

/**
 * Nouns that make a page a place regardless of the reject list — "Tribal
 * Research Institute and Museum" is a museum first and an institute second.
 */
const STRONG_PLACE_NOUN = /museum|temple|mandir|\bpark\b|\bfalls\b|waterfall|\bjharna\b|\bdam\b|\bfort\b|sanctuary|national park|hot spring|\bdham\b|\bghat\b(?!shila)/i;

/**
 * Geographic features that are visitable but that the type classifier leaves
 * untyped: hot springs, river stretches, viewpoints, sacred groves.
 */
const PLACE_FEATURE_NOUN = /hot spring|\bspring\b|\bkund\b|\bghat\b|\briver\b|\bvalley\b|\bpoint\b|\bisland\b|\budyan\b|\bsarovar\b|\bvan\b|\bgrove\b|\bconfluence\b/i;

/**
 * Bounding box of Jharkhand, with a small margin. A record whose coordinates
 * fall outside it is somewhere else no matter what the district resolver said —
 * this catches pages reached through national categories (Gaya, Haridwar,
 * Dwarka) that happen to mention a Jharkhand place name in passing.
 */
export const isInJharkhand = (coordinates) => {
  if (!coordinates || !Number.isFinite(coordinates.lat) || !Number.isFinite(coordinates.lng)) {
    return true; // unknown coordinates are judged on the other rules
  }
  const { lat, lng } = coordinates;
  return lat >= 21.8 && lat <= 25.5 && lng >= 83.2 && lng <= 88.2;
};

/**
 * Opening phrases that declare the article's subject to be a settlement or an
 * administrative unit. These beat every other signal: "Chira Chas ... scenic
 * environs" trips the tourist-signal test, and "Chandrapura" gets typed as a
 * valley because its article mentions the Damodar Valley Corporation.
 */
const SETTLEMENT_DECLARATION = /\bis a census town\b|\bis a suburb\b|census town in the|\bCD block\b|community development block|\bis a village\b|\bis a town\b|\bis a city\b|\bis a neighbou?rhood\b|municipality|\bis a locality\b|urban agglomeration/i;

/**
 * Individually judged rejections: pages that pass every structural rule but are
 * not somewhere you can go. Festivals and art forms are cultural practices,
 * "Rajmahal Traps" is a geological formation, and the rest are railway or
 * industrial towns that reached us through a tourism category.
 */
const DENYLIST = new Set([
  'sarhul', 'sohrai', 'karam-festival', 'tusu', 'chhau',
  'rajmahal-traps', 'telen-river', 'deo-river',
  'jasidih', 'chakulia', 'parsudih', 'dhanbad',
]);

export const isTouristPlace = (record) => {
  const name = record.name || '';
  if (record.slug && DENYLIST.has(record.slug)) return false;
  const description = record.description || '';
  const hasImage = record.images?.length > 0;

  if (!isInJharkhand(record.coordinates)) return false;

  if (REJECT_TITLE_PATTERNS.some(p => p.test(name)) && !STRONG_PLACE_NOUN.test(name)) return false;

  // A place described as a town or a block is not a destination, whatever the
  // type classifier made of stray words elsewhere in the article.
  if (SETTLEMENT_DECLARATION.test(description) && !STRONG_PLACE_NOUN.test(name)) return false;

  // A neighbourhood inside a city ("Kadma, Jamshedpur") is not a destination.
  if (record.type === 'city' && /,/.test(name)) return false;

  if (TOURISTIC_TYPES.has(record.type)) return true;

  // Untyped or a settlement: it needs to read as a visitor destination, plus
  // either a photograph or a name that is itself a geographic feature.
  if (!TOURIST_SIGNALS.test(description)) return false;
  return hasImage || PLACE_FEATURE_NOUN.test(name);
};

/**
 * Type rules, most specific first. The title is weighed on its own before
 * categories are considered — a page's category list mentions "monuments" far
 * more loosely than its title does, which is how "Rajmahal hills" ended up
 * classified as a museum.
 */
export const TYPE_RULES = [
  [/waterfall|\bfalls\b|jharna|ghagh/i, 'waterfall'],
  [/temple|mandir|\bdham\b|shrine|\bmath\b|masjid|mosque|church|basilica|gurudwara|jyotirlinga/i, 'temple'],
  [/\bdam\b|reservoir|barrage/i, 'dam'],
  [/national park|tiger reserve|wildlife|sanctuary|\bzoo\b|biological park|deer park/i, 'wildlife'],
  [/\bhill\b|\bhills\b|valley|plateau|\bpahar|\bpeak\b|mountain|netarhat|hill station/i, 'hill'],
  [/\blake\b|\btalab\b|\bsarovar\b|\bjheel\b|hot spring/i, 'lake'],
  [/\bfort\b|\bqila\b|palace|\bgarh\b(?!wa)/i, 'fort'],
  [/museum|art gallery|memorial|monument/i, 'museum'],
  [/\bpark\b|garden|\budyan\b/i, 'park'],
  [/archaeolog|heritage site|megalith|rock art|\bcave\b|\bcaves\b/i, 'heritage'],
  [/\bcity\b|\btown\b|nagar\b/i, 'city'],
];

export const inferType = (title = '', categories = '', extract = '') => {
  // A river is not a viewing point. Left untyped so the curation rules decide
  // on the evidence, rather than being classified "waterfall" because its
  // article happens to mention a falls along its course.
  if (/\briver\b/i.test(title)) return 'other';

  for (const [pattern, type] of TYPE_RULES) {
    if (pattern.test(title)) return type;
  }
  for (const [pattern, type] of TYPE_RULES) {
    if (pattern.test(categories)) return type;
  }
  for (const [pattern, type] of TYPE_RULES) {
    if (pattern.test(extract)) return type;
  }
  return 'other';
};
