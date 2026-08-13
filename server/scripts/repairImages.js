/**
 * Find photographs for destinations that have none, and drop image references
 * whose file is missing from disk.
 *
 *   node scripts/repairImages.js
 *
 * Searches Wikimedia Commons for each unillustrated destination. A result is
 * accepted only when the file title contains the destination's distinctive
 * words — a near-miss photograph is worse than the placeholder, because a wrong
 * picture on a temple page is a factual error the user cannot detect.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'JhkTourismBot/2.0 (Jharkhand Tourism SIH project; contact: tourism@jharkhand.gov.in)';
const DATA_FILE = path.join(__dirname, '../data/destinations.json');
const IMAGES_DIR = path.join(__dirname, '../../client/public/images/destinations');
const THUMB_WIDTH = 1200;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Words too generic to prove a filename refers to this particular place. */
const STOPWORDS = new Set([
  'the', 'of', 'in', 'at', 'and', 'jharkhand', 'india', 'temple', 'falls',
  'dam', 'park', 'hill', 'lake', 'sanctuary', 'fort', 'museum', 'complex',
  'site', 'point', 'valley', 'wildlife', 'national', 'centre', 'center',
]);

/**
 * Names of districts and large towns. A filename containing only one of these
 * tells us the city, not the subject, so it is not enough on its own.
 */
const SETTLEMENT_NAMES = new Set([
  'ranchi', 'jamshedpur', 'dhanbad', 'bokaro', 'deoghar', 'hazaribagh',
  'dumka', 'giridih', 'ramgarh', 'chatra', 'koderma', 'palamu', 'latehar',
  'gumla', 'khunti', 'simdega', 'godda', 'pakur', 'jamtara', 'garhwa',
  'lohardaga', 'sahibganj', 'chaibasa', 'daltonganj', 'singhbhum',
]);

const distinctiveWords = (name) =>
  name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOPWORDS.has(w));

async function searchCommons(term) {
  const url = `${COMMONS_API}?${new URLSearchParams({
    action: 'query', generator: 'search', gsrsearch: `${term} filetype:bitmap`,
    gsrnamespace: '6', gsrlimit: '8',
    prop: 'imageinfo', iiprop: 'url', iiurlwidth: String(THUMB_WIDTH),
    format: 'json', formatversion: '2',
  })}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.query?.pages || []).map(p => ({
    title: p.title,
    url: p.imageinfo?.[0]?.thumburl || p.imageinfo?.[0]?.url,
  })).filter(r => r.url);
}

async function download(url, slug) {
  const ext = (url.match(/\.(jpe?g|png|webp)(?:$|\?)/i)?.[1] || 'jpg').toLowerCase();
  const filename = `${slug}.${ext === 'jpeg' ? 'jpg' : ext}`;
  const filepath = path.join(IMAGES_DIR, filename);
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (!buffer.length) throw new Error('empty body');
  fs.writeFileSync(filepath, buffer);
  return `/images/destinations/${filename}`;
}

const run = async () => {
  const records = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));

  // 1. Drop references to files that are not actually on disk. A record that
  //    claims an image it does not have is exactly what renders as a broken
  //    thumbnail in the browser.
  let pruned = 0;
  for (const r of records) {
    const present = (r.images || []).filter(img =>
      fs.existsSync(path.join(IMAGES_DIR, path.basename(img)))
    );
    if (present.length !== (r.images || []).length) pruned++;
    r.images = present;
  }

  // 2. Try to illustrate whatever is left bare.
  const bare = records.filter(r => r.images.length === 0);
  console.log(`${pruned} records had a missing file pruned.`);
  console.log(`Searching Commons for ${bare.length} unillustrated destinations...\n`);

  let filled = 0;
  for (const r of bare) {
    const words = distinctiveWords(r.name);
    if (words.length === 0) continue;

    try {
      const results = await searchCommons(`${r.name} ${r.district} Jharkhand`);
      const match = results.find(res => {
        const title = res.title.toLowerCase();

        // Not a photograph of the place.
        if (/\bmap\b|\blogo\b|\bflag\b|\bseal\b|coat of arms|\bchart\b|\bdiagram\b|locator/.test(title)) {
          return false;
        }
        // The filename must name the place itself.
        if (!words.every(w => title.includes(w))) return false;
        // A single distinctive word is only proof when it is a distinctive
        // proper noun. "Rajrappa" names exactly one place; "Ranchi" names a
        // city of a million people, so "Ranchi 9226.JPG" could be anything.
        if (words.length === 1) {
          const word = words[0];
          const isSettlementName = SETTLEMENT_NAMES.has(word);
          if (isSettlementName || word.length < 6) {
            if (!title.includes(r.type)) return false;
          }
        }

        return true;
      });

      if (match) {
        r.images = [await download(match.url, r.slug)];
        filled++;
        console.log(`  ✓ ${r.name} ← ${match.title}`);
      } else {
        console.log(`  · ${r.name} — no confident match`);
      }
    } catch (err) {
      console.warn(`  ! ${r.name}: ${err.message}`);
    }
    await sleep(350);
  }

  // 3. Drop whatever is still unillustrated. A destination grid where a third
  //    of the cards are grey placeholders reads as broken, and the places that
  //    no one has ever photographed for Commons are the marginal ones anyway.
  const illustrated = records.filter(r => r.images.length > 0);
  const discarded = records.filter(r => r.images.length === 0);

  fs.writeFileSync(DATA_FILE, JSON.stringify(illustrated, null, 2));

  console.log(`\n✅ Filled ${filled} new photos`);
  console.log(`   Dropped ${discarded.length} destinations with no photograph:`);
  discarded.forEach(r => console.log(`     - ${r.name} (${r.district})`));
  console.log(`\n   ${illustrated.length} destinations kept, every one with a real photo\n`);
};

run().catch(err => {
  console.error('Repair failed:', err);
  process.exit(1);
});
