/**
 * The 24 districts of Jharkhand — the single list every district dropdown uses.
 *
 * Operator-facing forms previously offered only five districts, so an operator
 * in, say, Bokaro or Gumla literally could not say where they were. Since the
 * tourist-facing filters are built from the real data, a listing in a district
 * the form did not offer could never be found either.
 *
 * Kept in sync with server/data/districts.js, which is the authority.
 */
export const JHARKHAND_DISTRICTS = [
  'Bokaro',
  'Chatra',
  'Deoghar',
  'Dhanbad',
  'Dumka',
  'East Singhbhum',
  'Garhwa',
  'Giridih',
  'Godda',
  'Gumla',
  'Hazaribagh',
  'Jamtara',
  'Khunti',
  'Koderma',
  'Latehar',
  'Lohardaga',
  'Pakur',
  'Palamu',
  'Ramgarh',
  'Ranchi',
  'Sahibganj',
  'Seraikela-Kharsawan',
  'Simdega',
  'West Singhbhum',
];

/** Well-known landmarks, shown as a hint beside the district name. */
const DISTRICT_HINTS = {
  'Latehar': 'Netarhat / Betla',
  'Ranchi': 'Hundru / Jonha',
  'Deoghar': 'Baidyanath Dham',
  'East Singhbhum': 'Jamshedpur / Dalma',
  'Hazaribagh': 'Sohrai country',
  'Giridih': 'Parasnath / Shikharji',
  'Dumka': 'Massanjore / Maluti',
  'Ramgarh': 'Patratu / Rajrappa',
  'West Singhbhum': 'Saranda',
  'Palamu': 'Palamau Tiger Reserve',
};

export const DISTRICT_OPTIONS = JHARKHAND_DISTRICTS.map(name => ({
  value: name,
  label: DISTRICT_HINTS[name] ? `${name} (${DISTRICT_HINTS[name]})` : name,
}));
