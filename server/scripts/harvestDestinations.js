/**
 * Harvest every documented tourist place in Jharkhand from Wikipedia.
 *
 *   node scripts/harvestDestinations.js
 *
 * Replaces the old generateDestinations.js, which produced 42 places, hardcoded
 * every district to the string "Jharkhand" (breaking the district filter),
 * assigned each place a random homestay/guide category and a random price, and
 * downloaded full-resolution originals up to 19 MB each.
 *
 * What this does instead:
 *  - crawls a seed set of categories two levels deep, so district-level and
 *    type-level subcategories get picked up as well
 *  - resolves the real district from the page's coordinates (falling back to a
 *    scan of the article text), and drops pages it cannot place in Jharkhand
 *  - classifies each place by type (waterfall / temple / dam / ...)
 *  - downloads Wikipedia's 1200px-wide thumbnail rather than the original
 *
 * Output: server/data/destinations.json + client/public/images/destinations/*.jpg
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  districtFromCoordinates,
  districtFromText,
  districtFromExplicitText,
} from '../data/districts.js';
import { inferType, isTouristPlace } from '../data/curation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const UA = 'JhkTourismBot/2.0 (Jharkhand Tourism SIH project; contact: tourism@jharkhand.gov.in)';
const IMAGES_DIR = path.join(__dirname, '../../client/public/images/destinations');
const OUTPUT_FILE = path.join(__dirname, '../data/destinations.json');
const THUMB_WIDTH = 1200;
const MAX_DEPTH = 2;

const SEED_CATEGORIES = [
  'Category:Tourist attractions in Jharkhand',
  'Category:Tourism in Jharkhand',
  'Category:Waterfalls of Jharkhand',
  'Category:Hindu temples in Jharkhand',
  'Category:Jain temples in Jharkhand',
  'Category:Dams in Jharkhand',
  'Category:Parks in Jharkhand',
  'Category:Protected areas of Jharkhand',
  'Category:Wildlife sanctuaries of Jharkhand',
  'Category:National parks of Jharkhand',
  'Category:Forts in Jharkhand',
  'Category:Museums in Jharkhand',
  'Category:Hill stations in Jharkhand',
  'Category:Lakes of Jharkhand',
  'Category:Rivers of Jharkhand',
  'Category:Archaeological sites in Jharkhand',
  'Category:Churches in Jharkhand',
  'Category:Mosques in Jharkhand',
  'Category:Buddhist temples in Jharkhand',
  'Category:Monuments and memorials in Jharkhand',
  'Category:Cities and towns in Jharkhand',
  'Category:Geography of Jharkhand',
];

/** Subcategories that lead away from places-to-visit and into administrative trivia. */
const CATEGORY_BLOCKLIST = [
  'politic', 'election', 'people', 'births', 'deaths', 'sportspeople',
  'cricket', 'football', 'university', 'colleges', 'schools', 'education',
  'companies', 'economy', 'mining compan', 'railway stations', 'transport',
  'assembly constituenc', 'lok sabha', 'districts of', 'villages in',
  'census', 'stub', 'writers', 'films', 'music', 'language', 'tribes',
  'organisations', 'government', 'hospitals', 'banks', 'newspapers',
];

/** Pages that are lists, categories or the state itself rather than a place. */
const PAGE_BLOCKLIST = [
  'Jharkhand', 'Tourism in Jharkhand', 'List of', 'Outline of', 'Index of',
  'Category:', 'Template:', 'Portal:', 'Draft:', 'Talk:', 'File:',
  'History of', 'Economy of', 'Culture of', 'Districts of',
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function wikiGet(params) {
  const url = `${WIKI_API}?${new URLSearchParams({ ...params, format: 'json', formatversion: '2' })}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === 2) throw err;
      await sleep(1000 * (attempt + 1));
    }
  }
}

/** Category members, following continuations so we are not capped at one page. */
async function fetchCategoryMembers(category) {
  const members = [];
  let cont;
  do {
    const data = await wikiGet({
      action: 'query',
      list: 'categorymembers',
      cmtitle: category,
      cmlimit: '500',
      cmtype: 'page|subcat',
      ...(cont ? { cmcontinue: cont } : {}),
    });
    members.push(...(data.query?.categorymembers || []));
    cont = data.continue?.cmcontinue;
  } while (cont);
  return members;
}

/** Crawl seed categories `MAX_DEPTH` levels deep, collecting article titles. */
async function crawlCategories() {
  const seenCategories = new Set();
  const titles = new Set();
  let frontier = SEED_CATEGORIES.map(c => ({ category: c, depth: 0 }));

  while (frontier.length) {
    const next = [];
    for (const { category, depth } of frontier) {
      if (seenCategories.has(category)) continue;
      seenCategories.add(category);

      let members;
      try {
        members = await fetchCategoryMembers(category);
      } catch (err) {
        console.warn(`  ! ${category}: ${err.message}`);
        continue;
      }

      let added = 0;
      for (const m of members) {
        if (m.ns === 14) {
          const lower = m.title.toLowerCase();
          const isNoise = CATEGORY_BLOCKLIST.some(b => lower.includes(b));
          if (!isNoise && depth + 1 <= MAX_DEPTH) {
            next.push({ category: m.title, depth: depth + 1 });
          }
        } else if (m.ns === 0) {
          if (!PAGE_BLOCKLIST.some(b => m.title.startsWith(b) || m.title === b)) {
            if (!titles.has(m.title)) added++;
            titles.add(m.title);
          }
        }
      }
      console.log(`  ${'  '.repeat(depth)}${category} → +${added} (total ${titles.size})`);
      await sleep(200);
    }
    frontier = next;
  }
  return Array.from(titles);
}

/** Full detail for up to 20 titles at a time: extract, thumbnail, coordinates, categories. */
/**
 * Lead-section wikitext for pages we could not place. The infobox almost always
 * carries `district =` or `location =` even when the article has no geotag and
 * the prose never names a district.
 */
async function fetchLeadWikitext(titles) {
  const data = await wikiGet({
    action: 'query',
    prop: 'revisions',
    rvprop: 'content',
    rvslots: 'main',
    rvsection: '0',
    titles: titles.join('|'),
  });
  const map = new Map();
  for (const page of data.query?.pages || []) {
    const content = page.revisions?.[0]?.slots?.main?.content;
    if (content) map.set(page.title, content);
  }
  return map;
}

async function fetchPageDetails(titles) {
  const data = await wikiGet({
    action: 'query',
    prop: 'extracts|pageimages|coordinates|categories',
    exintro: '1',
    explaintext: '1',
    exsentences: '4',
    piprop: 'thumbnail',
    pithumbsize: String(THUMB_WIDTH),
    coprop: 'type',
    cllimit: '500',
    titles: titles.join('|'),
  });
  return data.query?.pages || [];
}

function typeOf(page) {
  const categoryText = (page.categories || []).map(c => c.title).join(' ');
  return inferType(page.title, categoryText, page.extract || '');
}

const BEST_SEASON_BY_TYPE = {
  waterfall: 'July to October, when the falls are in full flow',
  wildlife: 'November to March, when animals gather at waterholes',
  hill: 'October to March',
  dam: 'August to February',
  temple: 'All year; busiest during festival season',
  lake: 'October to March',
};

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function downloadImage(url, slug) {
  const ext = (url.match(/\.(jpe?g|png|webp)(?:$|\?)/i)?.[1] || 'jpg').toLowerCase();
  const filename = `${slug}.${ext === 'jpeg' ? 'jpg' : ext}`;
  const filepath = path.join(IMAGES_DIR, filename);
  const publicPath = `/images/destinations/${filename}`;

  if (fs.existsSync(filepath) && fs.statSync(filepath).size > 0) return publicPath;

  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0) throw new Error('empty body');
  fs.writeFileSync(filepath, buffer);
  return publicPath;
}

async function run() {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  console.log('Crawling Wikipedia categories...\n');
  const titles = await crawlCategories();
  console.log(`\nCollected ${titles.length} candidate pages. Fetching details...\n`);

  const results = [];
  const skipped = { noDistrict: 0, noExtract: 0, noImage: 0, notTouristic: 0 };

  for (let i = 0; i < titles.length; i += 20) {
    const batch = titles.slice(i, i + 20);
    let pages;
    try {
      pages = await fetchPageDetails(batch);
    } catch (err) {
      console.warn(`  ! batch @${i}: ${err.message}`);
      continue;
    }

    // Resolve district from coordinates or prose first; anything still
    // unplaced gets one extra round trip for its infobox.
    const candidates = [];
    const needsWikitext = [];

    for (const page of pages) {
      if (page.missing) continue;
      const extract = (page.extract || '').trim();
      if (extract.length < 60) { skipped.noExtract++; continue; }

      const coord = page.coordinates?.[0];
      // An article that states its district outright beats the coordinate
      // lookup, which can only snap to the nearest headquarters.
      let district = districtFromExplicitText(extract);
      if (!district && coord) district = districtFromCoordinates(coord.lat, coord.lon);
      if (!district) district = districtFromText(`${page.title} ${extract}`);

      candidates.push({ page, extract, coord, district });
      if (!district) needsWikitext.push(page.title);
    }

    if (needsWikitext.length) {
      try {
        const wikitext = await fetchLeadWikitext(needsWikitext);
        for (const c of candidates) {
          if (c.district) continue;
          const text = wikitext.get(c.page.title);
          if (text) c.district = districtFromText(text);
        }
      } catch (err) {
        console.warn(`  ! wikitext batch @${i}: ${err.message}`);
      }
    }

    for (const { page, extract, coord, district } of candidates) {
      if (!district) { skipped.noDistrict++; continue; }

      const type = typeOf(page);

      // Decide whether this is a destination BEFORE spending a download on it.
      // `hasPhoto` stands in for the image we would fetch, which is one of the
      // signals the curation rules use.
      const hasPhoto = Boolean(page.thumbnail?.source);
      const coordinates = coord ? { lat: coord.lat, lng: coord.lon } : null;
      if (!isTouristPlace({
        name: page.title, type, description: extract, coordinates,
        images: hasPhoto ? ['pending'] : [],
      })) {
        skipped.notTouristic++;
        continue;
      }

      const slug = slugify(page.title);
      let images = [];
      if (hasPhoto) {
        try {
          images = [await downloadImage(page.thumbnail.source, slug)];
        } catch (err) {
          console.warn(`  ! image ${page.title}: ${err.message}`);
        }
      }
      if (images.length === 0) skipped.noImage++;

      results.push({
        slug,
        name: page.title,
        description: extract,
        district,
        type,
        images,
        coordinates: coord ? { lat: coord.lat, lng: coord.lon } : null,
        bestSeason: BEST_SEASON_BY_TYPE[type] || 'October to March',
        howToReach: `${district} district, Jharkhand. Nearest major road and rail links are via ${district} town; Ranchi (RNC) is the closest airport for most of the state.`,
        sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
      });
      console.log(`  ✓ ${page.title} — ${district} / ${type}${images.length ? '' : ' (no image)'}`);
    }
    await sleep(400);
  }

  results.sort((a, b) => a.district.localeCompare(b.district) || a.name.localeCompare(b.name));
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

  const byDistrict = results.reduce((acc, r) => {
    acc[r.district] = (acc[r.district] || 0) + 1;
    return acc;
  }, {});

  console.log(`\n✅ ${results.length} destinations written to ${OUTPUT_FILE}`);
  console.log(`   skipped: ${skipped.noDistrict} unplaceable, ${skipped.noExtract} no summary, ${skipped.notTouristic} not a destination`);
  console.log(`   ${results.filter(r => r.images.length).length} have images, ${skipped.noImage} do not\n`);
  console.log('   Per district:');
  Object.entries(byDistrict)
    .sort((a, b) => b[1] - a[1])
    .forEach(([d, n]) => console.log(`     ${d.padEnd(22)} ${n}`));
}

run().catch(err => {
  console.error('Harvest failed:', err);
  process.exit(1);
});
