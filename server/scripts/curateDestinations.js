/**
 * Re-apply the curation rules to an existing destinations.json.
 *
 *   node scripts/curateDestinations.js
 *
 * The harvester now filters as it goes, so this is only needed to re-curate a
 * file produced by an earlier run without spending another full crawl. It
 * re-infers each type from the title and drops administrative geography.
 * Images belonging to dropped records are deleted.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { inferType, isTouristPlace } from '../data/curation.js';
import { districtFromExplicitText } from '../data/districts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, '../data/destinations.json');
const IMAGES_DIR = path.join(__dirname, '../../client/public/images/destinations');

// Curate from the raw harvest when one is present, so the rules can be tuned
// and re-applied without discarding records an earlier, stricter pass removed.
const RAW_FILE = path.join(__dirname, '../data/destinations.raw.bak.json');
const SOURCE_FILE = fs.existsSync(RAW_FILE) ? RAW_FILE : DATA_FILE;
const records = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf-8'));

// Re-resolve the district from an explicit "<name> district" statement in the
// article, which outranks the coordinate-to-nearest-headquarters guess made at
// harvest time. `howToReach` embeds the district name, so it is rebuilt too.
let recorrected = 0;
const retyped = records.map(r => {
  const stated = districtFromExplicitText(r.description || '');
  const district = stated || r.district;
  if (stated && stated !== r.district) {
    recorrected++;
    console.log(`  ~ ${r.name}: ${r.district} → ${stated} (stated in the article)`);
  }
  return {
    ...r,
    district,
    type: inferType(r.name, '', r.description || ''),
    howToReach: r.howToReach?.replace(new RegExp(r.district, 'g'), district) || r.howToReach,
  };
});
const kept = retyped.filter(isTouristPlace);
const dropped = retyped.filter(r => !isTouristPlace(r));

// Reclaim disk from images belonging to records we are discarding.
let removedFiles = 0;
const keptImages = new Set(kept.flatMap(r => r.images || []));
for (const r of dropped) {
  for (const img of r.images || []) {
    if (keptImages.has(img)) continue;
    const filepath = path.join(IMAGES_DIR, path.basename(img));
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      removedFiles++;
    }
  }
}

kept.sort((a, b) => a.district.localeCompare(b.district) || a.name.localeCompare(b.name));
fs.writeFileSync(DATA_FILE, JSON.stringify(kept, null, 2));

const byType = kept.reduce((acc, r) => { acc[r.type] = (acc[r.type] || 0) + 1; return acc; }, {});
const byDistrict = kept.reduce((acc, r) => { acc[r.district] = (acc[r.district] || 0) + 1; return acc; }, {});

console.log(`\n✅ Kept ${kept.length} of ${records.length} destinations`);
console.log(`   corrected the district on ${recorrected} records`);
console.log(`   dropped ${dropped.length} administrative / non-touristic pages`);
console.log(`   deleted ${removedFiles} now-unused image files`);
console.log(`   ${kept.filter(r => r.images?.length).length} have a photo\n`);
console.log('   By type:');
Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([t, n]) => console.log(`     ${t.padEnd(12)} ${n}`));
console.log(`\n   Across ${Object.keys(byDistrict).length} districts.`);
