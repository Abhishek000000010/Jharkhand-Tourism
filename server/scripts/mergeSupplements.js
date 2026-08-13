/**
 * Merge the hand-curated destinations into destinations.json.
 *
 *   node scripts/mergeSupplements.js
 *
 * Run after harvestDestinations.js. Entries already present by slug are left
 * alone, so a later harvest that starts covering one of them wins. Where an
 * `imageSearch` term is given, a photograph is looked up on Wikipedia.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SUPPLEMENTAL_DESTINATIONS } from '../data/supplementalDestinations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const UA = 'JhkTourismBot/2.0 (Jharkhand Tourism SIH project; contact: tourism@jharkhand.gov.in)';
const DATA_FILE = path.join(__dirname, '../data/destinations.json');
const IMAGES_DIR = path.join(__dirname, '../../client/public/images/destinations');
const THUMB_WIDTH = 1200;

const slugify = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

async function findThumbnail(term) {
  const url = `${WIKI_API}?${new URLSearchParams({
    action: 'query', generator: 'search', gsrsearch: term, gsrlimit: '1',
    prop: 'pageimages', piprop: 'thumbnail', pithumbsize: String(THUMB_WIDTH),
    format: 'json', formatversion: '2',
  })}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.query?.pages?.[0]?.thumbnail?.source || null;
}

async function download(url, slug) {
  const ext = (url.match(/\.(jpe?g|png|webp)(?:$|\?)/i)?.[1] || 'jpg').toLowerCase();
  const filename = `${slug}.${ext === 'jpeg' ? 'jpg' : ext}`;
  const filepath = path.join(IMAGES_DIR, filename);
  if (fs.existsSync(filepath) && fs.statSync(filepath).size > 0) {
    return `/images/destinations/${filename}`;
  }
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (!buffer.length) throw new Error('empty body');
  fs.writeFileSync(filepath, buffer);
  return `/images/destinations/${filename}`;
}

const run = async () => {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  const existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const bySlug = new Set(existing.map(r => r.slug));

  let added = 0;
  let withPhoto = 0;

  for (const entry of SUPPLEMENTAL_DESTINATIONS) {
    const slug = slugify(entry.name);
    if (bySlug.has(slug)) {
      console.log(`  = ${entry.name} (already harvested)`);
      continue;
    }

    let images = [];
    if (entry.imageSearch) {
      try {
        const src = await findThumbnail(entry.imageSearch);
        if (src) {
          images = [await download(src, slug)];
          withPhoto++;
        }
      } catch (err) {
        console.warn(`  ! image ${entry.name}: ${err.message}`);
      }
    }

    existing.push({
      slug,
      name: entry.name,
      description: entry.description,
      district: entry.district,
      type: entry.type,
      images,
      coordinates: entry.coordinates || null,
      bestSeason: entry.bestSeason || 'October to March',
      howToReach: entry.howToReach
        || `${entry.district} district, Jharkhand. Ranchi (RNC) is the closest airport for most of the state.`,
      sourceUrl: '',
    });
    bySlug.add(slug);
    added++;
    console.log(`  + ${entry.name} — ${entry.district} / ${entry.type}${images.length ? '' : ' (no image)'}`);
  }

  existing.sort((a, b) => a.district.localeCompare(b.district) || a.name.localeCompare(b.name));
  fs.writeFileSync(DATA_FILE, JSON.stringify(existing, null, 2));

  console.log(`\n✅ Added ${added} curated destinations (${withPhoto} with a photo)`);
  console.log(`   ${existing.length} destinations total\n`);
};

run().catch(err => {
  console.error('Merge failed:', err);
  process.exit(1);
});
