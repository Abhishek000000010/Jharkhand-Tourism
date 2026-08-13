/**
 * The 24 districts of Jharkhand, with administrative-headquarters coordinates.
 *
 * Used for two things:
 *  - resolving a Wikipedia page's coordinates to the district it sits in
 *  - centring the map when a district filter is applied
 */
export const JHARKHAND_DISTRICTS = [
  { name: 'Bokaro', lat: 23.6693, lng: 86.1511 },
  { name: 'Chatra', lat: 24.2069, lng: 84.8710 },
  { name: 'Deoghar', lat: 24.4823, lng: 86.6969 },
  { name: 'Dhanbad', lat: 23.7957, lng: 86.4304 },
  { name: 'Dumka', lat: 24.2676, lng: 87.2495 },
  { name: 'East Singhbhum', lat: 22.8046, lng: 86.2029 },
  { name: 'Garhwa', lat: 24.1547, lng: 83.8081 },
  { name: 'Giridih', lat: 24.1913, lng: 86.3095 },
  { name: 'Godda', lat: 24.8268, lng: 87.2128 },
  { name: 'Gumla', lat: 23.0444, lng: 84.5386 },
  { name: 'Hazaribagh', lat: 23.9925, lng: 85.3637 },
  { name: 'Jamtara', lat: 23.9628, lng: 86.8036 },
  { name: 'Khunti', lat: 23.0721, lng: 85.2782 },
  { name: 'Koderma', lat: 24.4676, lng: 85.5940 },
  { name: 'Latehar', lat: 23.7443, lng: 84.4998 },
  { name: 'Lohardaga', lat: 23.4333, lng: 84.6833 },
  { name: 'Pakur', lat: 24.6339, lng: 87.8460 },
  { name: 'Palamu', lat: 24.0333, lng: 84.0667 },
  { name: 'Ramgarh', lat: 23.6304, lng: 85.5140 },
  { name: 'Ranchi', lat: 23.3441, lng: 85.3096 },
  { name: 'Sahibganj', lat: 25.2495, lng: 87.6416 },
  { name: 'Seraikela-Kharsawan', lat: 22.7000, lng: 85.9333 },
  { name: 'Simdega', lat: 22.6167, lng: 84.5167 },
  { name: 'West Singhbhum', lat: 22.5586, lng: 85.8000 },
];

export const DISTRICT_NAMES = JHARKHAND_DISTRICTS.map(d => d.name);

/**
 * Towns, blocks and landmarks mapped to their district.
 *
 * Many Wikipedia articles about Jharkhand attractions carry no geotag and never
 * name their district in the lead — "Chandil Dam" says only that it is on the
 * Subarnarekha at Chandil. Without this gazetteer those pages are unplaceable
 * and get dropped, which is how the first harvest lost Chandil Dam, Panchghagh
 * Falls and Deori Temple.
 */
export const PLACE_GAZETTEER = {
  'chandil': 'Seraikela-Kharsawan',
  'kharsawan': 'Seraikela-Kharsawan',
  'adityapur': 'Seraikela-Kharsawan',
  'netarhat': 'Latehar',
  'mahuadanr': 'Latehar',
  'betla': 'Latehar',
  'chandwa': 'Latehar',
  'patratu': 'Ramgarh',
  'ramgarh cantonment': 'Ramgarh',
  'barkakana': 'Ramgarh',
  'rajrappa': 'Ramgarh',
  'ghatshila': 'East Singhbhum',
  'musabani': 'East Singhbhum',
  'jadugora': 'East Singhbhum',
  'dalma': 'East Singhbhum',
  'baharagora': 'East Singhbhum',
  'chaibasa': 'West Singhbhum',
  'saranda': 'West Singhbhum',
  'noamundi': 'West Singhbhum',
  'chakradharpur': 'West Singhbhum',
  'khunti': 'Khunti',
  'torpa': 'Khunti',
  'tamar': 'Ranchi',
  'bundu': 'Ranchi',
  'ormanjhi': 'Ranchi',
  'angrabadi': 'Ranchi',
  'mccluskieganj': 'Ranchi',
  'sonahatu': 'Ranchi',
  'khelari': 'Ranchi',
  'bero': 'Ranchi',
  'itki': 'Ranchi',
  'barkagaon': 'Hazaribagh',
  'isco': 'Hazaribagh',
  'bhelwara': 'Hazaribagh',
  'canary hill': 'Hazaribagh',
  'barhi': 'Hazaribagh',
  'chouparan': 'Hazaribagh',
  'basukinath': 'Dumka',
  'massanjore': 'Dumka',
  'shikaripara': 'Dumka',
  'madhupur': 'Deoghar',
  'mohanpur': 'Deoghar',
  'trikut': 'Deoghar',
  'tapovan': 'Deoghar',
  'sarath': 'Deoghar',
  'madhuban': 'Giridih',
  'parasnath': 'Giridih',
  'shikharji': 'Giridih',
  'bagodar': 'Giridih',
  'dumri': 'Giridih',
  'usri': 'Giridih',
  'topchanchi': 'Dhanbad',
  'jharia': 'Dhanbad',
  'maithon': 'Dhanbad',
  'panchet': 'Dhanbad',
  'nirsa': 'Dhanbad',
  'chirkunda': 'Dhanbad',
  'bermo': 'Bokaro',
  'chas': 'Bokaro',
  'gomia': 'Bokaro',
  'tenughat': 'Bokaro',
  'konar': 'Bokaro',
  'lugu': 'Bokaro',
  'tilaiya': 'Koderma',
  'jhumri telaiya': 'Koderma',
  'itkhori': 'Chatra',
  'tandwa': 'Chatra',
  'lawalong': 'Chatra',
  'daltonganj': 'Palamu',
  'medininagar': 'Palamu',
  'hussainabad': 'Palamu',
  'panki': 'Palamu',
  'nagar untari': 'Garhwa',
  'bhawnathpur': 'Garhwa',
  'sahibganj': 'Sahibganj',
  'rajmahal': 'Sahibganj',
  'udhwa': 'Sahibganj',
  'mandro': 'Sahibganj',
  'maluti': 'Dumka',
  'littipara': 'Pakur',
  'maheshpur': 'Pakur',
  'simdega': 'Simdega',
  'kolebira': 'Simdega',
  'lohardaga': 'Lohardaga',
  'kisko': 'Lohardaga',
  'gumla': 'Gumla',
  'sisai': 'Gumla',
  'raidih': 'Gumla',
  'bishunpur': 'Gumla',
  'chainpur': 'Gumla',
  'godda': 'Godda',
  'sunderpahari': 'Godda',
  'poreyahat': 'Godda',
  'jamtara': 'Jamtara',
  'narayanpur': 'Jamtara',
};

/** Alternate spellings that appear in Wikipedia prose, mapped to our canonical name. */
export const DISTRICT_ALIASES = {
  'purbi singhbhum': 'East Singhbhum',
  'east singhbhum': 'East Singhbhum',
  'jamshedpur': 'East Singhbhum',
  'singhbhum east': 'East Singhbhum',
  'pashchimi singhbhum': 'West Singhbhum',
  'west singhbhum': 'West Singhbhum',
  'chaibasa': 'West Singhbhum',
  'saraikela': 'Seraikela-Kharsawan',
  'seraikela': 'Seraikela-Kharsawan',
  'saraikela kharsawan': 'Seraikela-Kharsawan',
  'seraikela kharsawan': 'Seraikela-Kharsawan',
  'seraikella-kharsawan': 'Seraikela-Kharsawan',
  'palamau': 'Palamu',
  'palamu': 'Palamu',
  'daltonganj': 'Palamu',
  'medininagar': 'Palamu',
  'kodarma': 'Koderma',
  'koderma': 'Koderma',
  'hazaribag': 'Hazaribagh',
  'hazaribagh': 'Hazaribagh',
  'santhal pargana': 'Dumka',
  'jamtara': 'Jamtara',
  'bokaro steel city': 'Bokaro',
};

/**
 * Great-circle distance in km. Used to snap a coordinate to its district;
 * plain Euclidean distance on lat/lng skews badly enough at this latitude
 * to mis-assign places near district borders.
 */
export const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

/** Nearest district headquarters to a coordinate. */
export const districtFromCoordinates = (lat, lng) => {
  let best = null;
  let bestDist = Infinity;
  for (const d of JHARKHAND_DISTRICTS) {
    const dist = haversineKm(lat, lng, d.lat, d.lng);
    if (dist < bestDist) {
      bestDist = dist;
      best = d.name;
    }
  }
  // Beyond ~120 km from every headquarters the point is almost certainly
  // outside Jharkhand — better to report nothing than to guess.
  return bestDist <= 120 ? best : null;
};

/**
 * Match only an explicit "<name> district" / "district of <name>" statement.
 *
 * This outranks the coordinate lookup. Snapping a point to the nearest district
 * headquarters is a crude proxy: Hundru Falls sits on the Ranchi/Ramgarh border
 * and is physically closer to Ramgarh town, so the coordinate rule filed it
 * under Ramgarh even though its article opens "located in Ranchi District".
 */
export const districtFromExplicitText = (text = '') => {
  // Only the opening sentence, and only the earliest match in it. A reserve
  // that spreads across district lines lists every one of them further down —
  // Palamau Tiger Reserve names Garhwa in a later sentence, but its core and
  // its entry gate are in Latehar, which is what the lead says.
  const lower = text.slice(0, 220).toLowerCase();

  let best = null;
  let bestIndex = Infinity;

  const consider = (needle, canonical) => {
    const idx = lower.indexOf(needle);
    if (idx !== -1 && idx < bestIndex) {
      bestIndex = idx;
      best = canonical;
    }
  };

  for (const d of DISTRICT_NAMES) {
    const name = d.toLowerCase();
    consider(`${name} district`, d);
    consider(`district of ${name}`, d);
  }
  for (const [alias, canonical] of Object.entries(DISTRICT_ALIASES)) {
    consider(`${alias} district`, canonical);
  }

  return best;
};

/**
 * Scan free text for a district, a known alias, or a town in the gazetteer.
 *
 * Order matters: an explicit district name beats an alias, and both beat a
 * gazetteer town, since a town name can appear incidentally in prose about
 * somewhere else.
 */
export const districtFromText = (text = '') => {
  const lower = text.toLowerCase();

  for (const d of DISTRICT_NAMES) {
    if (lower.includes(`${d.toLowerCase()} district`)) return d;
  }
  for (const [alias, canonical] of Object.entries(DISTRICT_ALIASES)) {
    if (lower.includes(alias)) return canonical;
  }
  for (const d of DISTRICT_NAMES) {
    if (lower.includes(d.toLowerCase())) return d;
  }
  for (const [place, district] of Object.entries(PLACE_GAZETTEER)) {
    if (new RegExp(`\\b${place}\\b`, 'i').test(lower)) return district;
  }
  return null;
};
