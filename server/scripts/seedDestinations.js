/**
 * Load server/data/destinations.json into the Destination collection.
 *
 *   npm run seed:destinations
 *
 * Idempotent: upserts on `slug`, so re-running after a fresh harvest updates
 * existing rows instead of duplicating them.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Destination from '../models/Destination.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, '../data/destinations.json');

const run = async () => {
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`No data file at ${DATA_FILE}. Run: node scripts/harvestDestinations.js`);
    process.exit(1);
  }

  const destinations = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));

  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');

  const ops = destinations.map(d => ({
    updateOne: {
      filter: { slug: d.slug },
      update: {
        $set: {
          slug: d.slug,
          name: d.name,
          description: d.description,
          district: d.district,
          type: d.type,
          images: d.images || [],
          coordinates: d.coordinates || undefined,
          bestSeason: d.bestSeason,
          howToReach: d.howToReach,
          sourceUrl: d.sourceUrl,
          isActive: true,
        },
      },
      upsert: true,
    },
  }));

  const result = await Destination.bulkWrite(ops, { ordered: false });

  // Anything previously seeded but no longer in the curated file is retired
  // rather than deleted, so an id that was already linked from an itinerary
  // still resolves instead of 404-ing.
  const slugs = destinations.map(d => d.slug);
  const retired = await Destination.updateMany(
    { slug: { $nin: slugs }, isActive: true },
    { $set: { isActive: false } }
  );

  const total = await Destination.countDocuments({ isActive: true });

  const byDistrict = await Destination.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$district', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  console.log(`\n✅ ${result.upsertedCount} inserted, ${result.modifiedCount} updated, ${retired.modifiedCount} retired`);
  console.log(`   ${total} active destinations across ${byDistrict.length} districts\n`);
  byDistrict.forEach(d => console.log(`   ${d._id.padEnd(22)} ${d.count}`));

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(err => {
  console.error(`\n❌ Seed failed: ${err.message}`);
  process.exit(1);
});
