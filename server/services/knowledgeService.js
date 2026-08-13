import Destination from '../models/Destination.js';
import Listing from '../models/Listing.js';
import OperatorProfile from '../models/OperatorProfile.js';

/**
 * Retrieval for the site assistant.
 *
 * The old chatbot pasted all 82 destination NAMES into the system prompt and
 * nothing else — no prices, no ratings, no categories — so "which homestay is
 * good?" was unanswerable by construction. Stuffing the full catalogue instead
 * is not an option either: the local fallback runs at num_ctx 4096, and an
 * overflowing prompt is silently truncated from the front, which quietly drops
 * the instructions before it drops the data.
 *
 * So: score the catalogue against the question and send only the top rows.
 * Keyword scoring rather than embeddings — it needs no extra service, no
 * index to rebuild on every listing edit, and it still works with the network
 * unplugged, which is the whole point of the offline tier.
 */

/** Rows change rarely and the catalogue is small; re-reading it per message is waste. */
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache = { at: 0, destinations: [], listings: [] };

const loadCatalogue = async () => {
  if (Date.now() - cache.at < CACHE_TTL_MS) return cache;

  const [destinations, approvedProfiles] = await Promise.all([
    Destination.find({ isActive: true })
      .select('name slug type district description bestSeason')
      .lean(),
    OperatorProfile.find({ status: 'approved' }).select('user').lean(),
  ]);

  // Only approved operators, matching what the public Explore page shows. An
  // assistant that recommends an unverified listing would contradict the badge
  // the tourist sees when they click through.
  const listings = await Listing.find({
    isActive: true,
    operator: { $in: approvedProfiles.map(p => p.user) },
  })
    .select('title category district price description amenities languages specialities craftType rooms ratingSum ratingCount')
    .lean();

  cache = { at: Date.now(), destinations, listings };
  return cache;
};

/** Drop the cached catalogue — call after a listing or destination changes. */
export const invalidateKnowledgeCache = () => { cache = { at: 0, destinations: [], listings: [] }; };

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'for', 'of', 'in', 'on', 'at', 'and', 'or',
  'me', 'my', 'i', 'you', 'we', 'it', 'that', 'this', 'with', 'can', 'do', 'does', 'how', 'what',
  'which', 'where', 'when', 'who', 'why', 'there', 'any', 'some', 'please', 'tell', 'show', 'find',
  'want', 'need', 'like', 'about', 'from', 'near', 'have', 'has', 'be', 'get', 'go',
]);

const tokenize = (text) =>
  (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9ऀ-ॿ\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));

/**
 * Intent words, English and Hindi — the assistant advertises itself as
 * bilingual, so the retrieval has to be bilingual too or a Hindi question
 * silently falls back to generic results.
 */
const CATEGORY_WORDS = {
  homestay: ['homestay', 'homestays', 'stay', 'stays', 'staying', 'room', 'rooms', 'accommodation',
    'hotel', 'lodge', 'night', 'nights', 'होमस्टे', 'कमरा', 'ठहरने', 'रहने'],
  guide: ['guide', 'guides', 'trek', 'trekking', 'safari', 'tour', 'trip', 'hike', 'birding',
    'गाइड', 'सफारी'],
  artisan: ['craft', 'crafts', 'handicraft', 'artisan', 'souvenir', 'art', 'painting', 'dokra',
    'sohrai', 'bamboo', 'weaving', 'pottery', 'shop', 'buy', 'शिल्प', 'कला', 'हस्तशिल्प'],
};

const CHEAP_WORDS = ['cheap', 'cheapest', 'budget', 'affordable', 'low', 'inexpensive', 'under',
  'below', 'less', 'सस्ता', 'सस्ती', 'बजट'];
const QUALITY_WORDS = ['best', 'good', 'top', 'great', 'recommend', 'recommended', 'rated', 'rating',
  'nice', 'quality', 'popular', 'favourite', 'favorite', 'अच्छा', 'अच्छी', 'बेहतरीन', 'सबसे'];

const DESTINATION_TYPE_WORDS = {
  waterfall: ['waterfall', 'waterfalls', 'falls', 'झरना', 'जलप्रपात'],
  hill: ['hill', 'hills', 'mountain', 'valley', 'sunset', 'sunrise', 'पहाड़'],
  temple: ['temple', 'temples', 'religious', 'pilgrimage', 'mandir', 'मंदिर'],
  wildlife: ['wildlife', 'sanctuary', 'park', 'animal', 'animals', 'tiger', 'elephant', 'वन्यजीव'],
  fort: ['fort', 'forts', 'heritage', 'historic', 'history', 'किला'],
  lake: ['lake', 'dam', 'झील'],
};

const hits = (tokens, words) => tokens.some(t => words.includes(t));

const analyse = (query, districts) => {
  const tokens = tokenize(query);
  const lower = (query || '').toLowerCase();

  const categories = Object.entries(CATEGORY_WORDS)
    .filter(([, words]) => hits(tokens, words))
    .map(([cat]) => cat);

  const types = Object.entries(DESTINATION_TYPE_WORDS)
    .filter(([, words]) => hits(tokens, words))
    .map(([type]) => type);

  // District names are multi-word ("East Singhbhum"), so match on the raw
  // string rather than on tokens.
  const matchedDistricts = districts.filter(d => lower.includes(d.toLowerCase()));

  // "under 1500", "below ₹2000" — a budget question with a number in it.
  const priceCap = Number((lower.match(/(?:under|below|less than|within|upto|up to|<)\s*₹?\s*(\d{2,6})/) || [])[1]) || null;

  return {
    tokens,
    categories,
    types,
    districts: matchedDistricts,
    wantsCheap: hits(tokens, CHEAP_WORDS) || Boolean(priceCap),
    wantsQuality: hits(tokens, QUALITY_WORDS),
    priceCap,
  };
};

const avgRating = (l) => (l.ratingCount > 0 ? l.ratingSum / l.ratingCount : 0);

/**
 * Scores split into two parts on purpose.
 *
 * `relevance` is evidence the row has something to do with the question.
 * `score` adds the quality/price preferences used only to order rows that are
 * already relevant. Rating must not create relevance out of nothing, or every
 * question — including "how do I pay?" — retrieves the four highest-rated
 * listings and the model treats them as the answer.
 */
const scoreListing = (listing, intent) => {
  let relevance = 0;
  const bag = new Set(tokenize(
    [listing.title, listing.description, listing.district, listing.category, listing.craftType,
      ...(listing.amenities || []), ...(listing.specialities || []), ...(listing.languages || [])]
      .join(' ')
  ));

  for (const t of intent.tokens) if (bag.has(t)) relevance += 3;
  if (intent.categories.includes(listing.category)) relevance += 8;
  if (intent.districts.includes(listing.district)) relevance += 10;
  if (intent.priceCap && listing.price <= intent.priceCap) relevance += 6;

  let score = relevance + avgRating(listing) * (intent.wantsQuality ? 4 : 1.5);
  if (intent.wantsCheap) score += Math.max(0, 6 - listing.price / 500);

  return { relevance, score };
};

const scoreDestination = (dest, intent) => {
  let relevance = 0;
  const bag = new Set(tokenize([dest.name, dest.description, dest.district, dest.type].join(' ')));

  for (const t of intent.tokens) if (bag.has(t)) relevance += 3;
  if (intent.types.includes(dest.type)) relevance += 8;
  if (intent.districts.includes(dest.district)) relevance += 10;

  return { relevance, score: relevance };
};

/**
 * How the platform itself works. The catalogue answers "where should I go";
 * this answers "how do I book it", which is half of what a site assistant is
 * asked and none of which lives in the database.
 *
 * Kept deliberately short and strictly to behaviour that exists in the code —
 * an assistant that promises a feature we have not built is a support ticket.
 */
const SITE_FACTS = `About this platform:
- Jharkhand Tourism is a booking marketplace: verified homestays, local guides, and tribal-craft artisans across 22 districts.
- Browse destinations and listings on the Explore page. No account needed to look.
- To book, sign in as a tourist, open a listing, pick your dates, and pay online (Razorpay).
- Your dates are reserved for 10 minutes while you pay. If payment is not finished in that window the reservation is released. This 10-minute limit applies only to paying, nothing else.
- A booking goes: pending_payment -> confirmed once paid -> completed after the stay or tour. The operator can reject it, and you can cancel.
- Confirmed bookings come with a QR e-voucher the operator scans at check-in.
- You can review a listing only after that booking is completed, so ratings come from people who actually went.
- Every operator is verified by the Jharkhand Tourism Department against ID and property documents before their listings go public.
- Homestays are priced per night, guides per day, and crafts per item.
- Operators sign up via "Get started", choose the operator role, and upload documents for verification.
- The AI Planner builds a day-by-day trip from these same real destinations and listings.`;

const formatListing = (l) => {
  const rating = l.ratingCount > 0
    ? `${avgRating(l).toFixed(1)}/5 from ${l.ratingCount} review${l.ratingCount === 1 ? '' : 's'}`
    : 'no reviews yet';
  const unit = l.category === 'homestay' ? 'per night' : l.category === 'guide' ? 'per day' : 'per item';
  const extra = [
    l.category === 'homestay' && l.rooms ? `${l.rooms} rooms` : null,
    (l.amenities || []).slice(0, 4).join('/') || null,
    (l.specialities || []).slice(0, 3).join('/') || null,
    (l.languages || []).length ? `speaks ${l.languages.slice(0, 3).join('/')}` : null,
    l.craftType || null,
  ].filter(Boolean).join(', ');

  return `- ${l.title} (${l.category}, ${l.district}) — ₹${l.price} ${unit}, rated ${rating}${extra ? `. ${extra}` : ''}`;
};

const formatDestination = (d) =>
  `- ${d.name} (${d.type}, ${d.district})${d.bestSeason ? `, best in ${d.bestSeason}` : ''}: ${(d.description || '').slice(0, 110)}`;

const MAX_DESTINATIONS = 8;
const MAX_LISTINGS = 8;

/**
 * Build the grounding block for one question.
 *
 * Returns the prompt text AND the rows it was built from, so the caller can
 * render real links instead of trusting the model's prose. The itinerary audit
 * showed a 1.5B model writing "Betla National Park" into a Latehar trip — the
 * structured rows are the only part safe to put in front of a tourist.
 */
export const retrieveContext = async (query, history = []) => {
  const { destinations, listings } = await loadCatalogue();
  const districts = [...new Set(destinations.map(d => d.district).filter(Boolean))];
  const intent = analyse(query, districts);

  // "And what about a guide there?" carries its district only in the previous
  // turn. Without this the follow-up silently retrieved guides from the wrong
  // side of the state. Only the place-ish parts of the earlier intent carry
  // over — the category must come from the current question, or "a guide there"
  // would keep retrieving the homestays that were asked about before.
  if (intent.districts.length === 0 || intent.types.length === 0) {
    const priorText = (Array.isArray(history) ? history : [])
      .filter(m => m && m.role === 'user' && typeof m.content === 'string')
      .slice(-2)
      .map(m => m.content)
      .join(' ');
    if (priorText) {
      const prior = analyse(priorText, districts);
      if (intent.districts.length === 0) intent.districts = prior.districts;
      if (intent.types.length === 0) intent.types = prior.types;
    }
  }

  const rank = (rows, scorer) =>
    rows
      .map(row => ({ row, ...scorer(row, intent) }))
      .sort((a, b) => b.score - a.score);

  // A stated budget is a hard filter, not a ranking hint. Asked for a homestay
  // "under 2000", the model was shown a ₹2200 one and told the tourist it fit —
  // a 1.5B model will not reliably compare two numbers, so the only dependable
  // fix is to never put the over-budget row in front of it.
  // Ask for a guide and you should not be shown homestays. Beyond noise, a 1.5B
  // model merges adjacent rows — asked for a guide near Netarhat it answered
  // "Netarhat Ridge Homestay offers a guide for ₹1800", welding the homestay's
  // name onto the guide's price. Rows it cannot see, it cannot merge.
  const inCategory = intent.categories.length
    ? listings.filter(l => intent.categories.includes(l.category))
    : listings;
  let candidateListings = inCategory.length ? inCategory : listings;

  // Same reasoning one level down. Ranking already put the Latehar guide first,
  // but with three other districts' guides beside it the model answered with
  // the Ranchi one — given several plausible rows it picks near-arbitrarily.
  // If the named district has matching rows, they are the only honest answers.
  let budgetNote = '';
  const districtRows = intent.districts.length
    ? candidateListings.filter(l => intent.districts.includes(l.district))
    : [];
  if (districtRows.length) candidateListings = districtRows;

  if (intent.priceCap) {
    const affordable = candidateListings.filter(l => l.price <= intent.priceCap);
    if (affordable.length) {
      candidateListings = affordable;
    } else if (districtRows.length) {
      // The budget empties the district the tourist named. Say that rather than
      // quietly answering with somewhere else — the old behaviour offered a
      // Deoghar homestay for a Latehar question and never mentioned the switch.
      budgetNote = `Nothing in ${intent.districts.join(' or ')} is listed at or under ₹${intent.priceCap}. Say that clearly first, then offer the closest options below.`;
      candidateListings = inCategory.length ? inCategory : listings;
    } else {
      budgetNote = `Nothing is listed at or under ₹${intent.priceCap}. Say so, and offer the closest options below.`;
    }
  }

  const rankedListings = rank(candidateListings, scoreListing);
  const rankedDestinations = rank(destinations, scoreDestination);

  const asksListing = intent.categories.length > 0 || intent.wantsCheap || intent.wantsQuality;
  const asksPlace = intent.types.length > 0 || intent.districts.length > 0;

  // "How do I pay?" is about the platform, not the catalogue. When nothing in
  // the question matches any row, send no rows at all — SITE_FACTS alone is the
  // correct context, and an unrelated listing in the prompt only invites the
  // model to work it into the answer.
  const anyMatch = rankedListings.some(x => x.relevance > 0) || rankedDestinations.some(x => x.relevance > 0);
  if (!anyMatch && !asksListing && !asksPlace) {
    return {
      contextText: SITE_FACTS,
      sources: { destinations: [], listings: [] },
      intent,
      totals: { destinations: destinations.length, listings: listings.length },
    };
  }

  const listingBudget = asksListing ? MAX_LISTINGS : asksPlace ? 4 : 5;
  // Zero destinations when the question is purely about bookable inventory.
  // Padding "which homestay is good?" with three arbitrary sightseeing rows is
  // exactly what made the model answer with a biological park instead of a
  // homestay — an unrelated row in context reads to a small model as a
  // candidate answer.
  // "A cheap homestay in Latehar" names a district, but the answer is a listing.
  // Eight sightseeing rows on top of it are pure distraction for a small model.
  const destinationBudget = asksListing
    ? (asksPlace ? 3 : 0)
    : asksPlace ? MAX_DESTINATIONS : 6;

  // Prefer rows the question actually touched; fall back to the best-rated ones
  // only when the tourist clearly asked for inventory and nothing matched.
  const relevantListings = rankedListings.filter(x => x.relevance > 0);
  const listingPool = relevantListings.length ? relevantListings : (asksListing ? rankedListings : []);
  const topListings = listingPool.slice(0, listingBudget).map(x => x.row);
  const topDestinations = rankedDestinations
    .filter(x => x.score > 0)
    .slice(0, destinationBudget)
    .map(x => x.row);

  const section = (label, rows, format) =>
    rows.length ? `\n\n${label}\n${rows.map(format).join('\n')}` : '';

  // The note leads. Placed after the rows it reads as a footnote and the model
  // ignored it, cheerfully presenting a Bokaro cottage as being in Latehar.
  const contextText = `${budgetNote ? `IMPORTANT: ${budgetNote}\n\n` : ''}${SITE_FACTS}${
    section(
      `Real destinations on the platform (${destinations.length} total, most relevant shown):`,
      topDestinations, formatDestination
    )}${
    section(
      `Real bookable listings from verified operators (${listings.length} total, most relevant shown):`,
      topListings, formatListing
    )}`;

  return {
    contextText,
    sources: {
      destinations: topDestinations.slice(0, 4).map(d => ({ slug: d.slug, name: d.name, type: d.type, district: d.district })),
      listings: topListings.slice(0, 4).map(l => ({
        id: l._id.toString(),
        title: l.title,
        category: l.category,
        district: l.district,
        price: l.price,
        rating: l.ratingCount > 0 ? Number(avgRating(l).toFixed(1)) : null,
        ratingCount: l.ratingCount || 0,
      })),
    },
    intent,
    totals: { destinations: destinations.length, listings: listings.length },
  };
};
