// TEMPORARY timing harness for the offline itinerary path. Deleted after use.
import 'dotenv/config';
import mongoose from 'mongoose';
import Destination from '../models/Destination.js';
import { askAI, cleanJSON } from '../services/aiService.js';

await mongoose.connect(process.env.MONGO_URI);

const district = process.argv[2] || 'Palamu';
const days = Number(process.argv[3]) || 3;

const destinations = await Destination.find(
  district === 'all' ? { isActive: true } : { district, isActive: true }
).select('name slug type district description').limit(60).lean();

const MAX = Math.min(24, days * 4);
const ctx = destinations.slice(0, MAX).map(d => ({
  slug: d.slug, name: d.name, type: d.type, district: d.district,
  note: (d.description || '').slice(0, 90),
}));

const systemInstruction = `You are an expert travel planner for Jharkhand Tourism.
Build the itinerary strictly from the real places given.
- Name only places that appear in "Destinations". Never invent a place.
- Write ONE practical sentence per time slot. Be concise.
Respond with ONLY a valid JSON array.
[{"day":1,"title":"...","morning":"...","afternoon":"...","evening":"...","destinationSlugs":["slug"],"suggestedListingId":null}]`;

const prompt = `Destinations (REAL, ${ctx.length} available):
${JSON.stringify(ctx, null, 1)}

Listings (REAL, 0 available):
[]

User request:
Plan a ${days}-day trip to ${district} focused on nature and local culture.`;

console.log(`${district}, ${days} days · ${ctx.length} destinations · prompt ${prompt.length} chars`);

const t0 = Date.now();
const result = await askAI(prompt, systemInstruction, [{ day: 1 }], { json: true });
const ms = Date.now() - t0;

let count = 'n/a';
try {
  const parsed = JSON.parse(cleanJSON(result.response));
  const arr = Array.isArray(parsed) ? parsed : Object.values(parsed).find(Array.isArray);
  count = Array.isArray(arr) ? `${arr.length} days` : 'NO ARRAY';
} catch (e) { count = `PARSE FAIL: ${e.message}`; }

console.log(`  → ${result.tier}${result.model ? ` (${result.model})` : ''}  ${ms}ms  ${count}`);

await mongoose.disconnect();
