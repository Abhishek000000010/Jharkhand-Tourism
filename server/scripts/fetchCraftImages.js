/**
 * Download photographs for the demo craft and lodging listings.
 *
 *   node scripts/fetchCraftImages.js
 *
 * Real operators upload their own photographs through the portal; these exist
 * only so the seeded demo marketplace is not a wall of grey placeholders. Each
 * file is a Wikimedia Commons photograph of the craft the listing actually
 * sells, named for the listing that uses it.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'JhkTourismBot/2.0 (Jharkhand Tourism SIH project; contact: tourism@jharkhand.gov.in)';
const OUT_DIR = path.join(__dirname, '../../client/public/images/listings');

/** listing slug → the exact Commons file to use for it. */
const CRAFT_IMAGES = {
  'sohrai-painting': 'File:Sohrai painting, Jharkhand.jpg',
  'khovar-painting': 'File:A Munda tribesman sitting in front of wall decorated with Munda style Sohrai Painting at Isko Village, Hazaribagh.jpg',
  'dokra-elephant': 'File:Dokra art.png',
  'dokra-musicians': 'File:Making of Dokra Metal Craft.jpg',
  'chhau-mask': 'File:A Cultural Crescendo Chhau Dance 27.jpg',
  'bamboo-basket': 'File:Bamboo Basket Maker.jpg',
  'handloom-stole': 'File:Tussore Sarees - Phulia 2016-11-12 1893.JPG',
};

async function resolveUrl(fileTitle) {
  const url = `${COMMONS_API}?${new URLSearchParams({
    action: 'query', titles: fileTitle, prop: 'imageinfo',
    iiprop: 'url', iiurlwidth: '1200', format: 'json', formatversion: '2',
  })}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const info = data.query?.pages?.[0]?.imageinfo?.[0];
  return info?.thumburl || info?.url || null;
}

const run = async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const [slug, fileTitle] of Object.entries(CRAFT_IMAGES)) {
    try {
      const src = await resolveUrl(fileTitle);
      if (!src) { console.warn(`  ! ${slug}: not found`); continue; }

      const ext = (src.match(/\.(jpe?g|png|webp)(?:$|\?)/i)?.[1] || 'jpg').toLowerCase();
      const filename = `${slug}.${ext === 'jpeg' ? 'jpg' : ext}`;
      const filepath = path.join(OUT_DIR, filename);

      const res = await fetch(src, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(filepath, buffer);

      console.log(`  ✓ ${slug} → /images/listings/${filename}`);
    } catch (err) {
      console.warn(`  ! ${slug}: ${err.message}`);
    }
  }
  console.log('\n✅ Craft images downloaded to client/public/images/listings\n');
};

run().catch(err => { console.error(err); process.exit(1); });
