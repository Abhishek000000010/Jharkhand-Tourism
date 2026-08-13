import { askAI, cleanJSON, getAIStatus } from '../services/aiService.js';
import { retrieveContext } from '../services/knowledgeService.js';
import Listing from '../models/Listing.js';
import Destination from '../models/Destination.js';
import OperatorProfile from '../models/OperatorProfile.js';

/**
 * Pull the AI's JSON out of a response that may be wrapped in prose or fences.
 * Models occasionally prepend "Here is your itinerary:" — parsing then throws and
 * the whole request silently degrades to the rules tier, which is what made the
 * planner look broken even when Gemini answered correctly.
 */
/** Does this look like one day of an itinerary, rather than some other object? */
const isDayShaped = (value) =>
  Boolean(value) &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  ('morning' in value || 'afternoon' in value || 'evening' in value || 'title' in value);

const parseItineraryJSON = (text) => {
  const cleaned = cleanJSON(text);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Fall back to slicing out the first balanced-looking JSON value in the text.
    const candidates = [
      [cleaned.indexOf('['), cleaned.lastIndexOf(']')],
      [cleaned.indexOf('{'), cleaned.lastIndexOf('}')],
    ].filter(([start, end]) => start !== -1 && end > start);

    for (const [start, end] of candidates) {
      try {
        parsed = JSON.parse(cleaned.slice(start, end + 1));
        break;
      } catch { /* try the next shape */ }
    }
    if (parsed === undefined) throw new Error('No JSON found in AI response');
  }

  if (Array.isArray(parsed)) {
    const days = parsed.filter(isDayShaped);
    if (days.length) return days;
    throw new Error('AI returned an array with no day objects in it');
  }

  if (parsed && typeof parsed === 'object') {
    // A small local model wraps the array in an object — {"itinerary": [...]}
    // or {"days": [...]}. Only accept an array whose ELEMENTS are days: the old
    // code took the first array of any kind, which picked up "destinationSlugs"
    // and turned the itinerary into a list of bare slug strings.
    const dayArray = Object.values(parsed)
      .filter(Array.isArray)
      .find(arr => arr.some(isDayShaped));
    if (dayArray) return dayArray.filter(isDayShaped);

    // Or it returns a single day object with no wrapper at all. That is one
    // valid day, not a failure — keep it.
    if (isDayShaped(parsed)) return [parsed];
  }

  throw new Error('AI response contained no itinerary days');
};

export const generateItinerary = async (req, res) => {
  const { district, duration, interests } = req.body;

  try {
    const days = Math.min(14, Math.max(1, parseInt(duration, 10) || 3));
    const interestText = (interests || '').trim() || 'nature and local culture';
    // An empty district means "anywhere in Jharkhand" rather than no results.
    const districtFilter = district && district !== 'all' ? { district } : {};
    const areaLabel = district && district !== 'all' ? district : 'Jharkhand';

    // 1. Real places to visit. This is the grounding that was missing before:
    //    the planner used to query only Listings, and every seeded place sat in
    //    a district literally named "Jharkhand", so every lookup returned zero
    //    rows and the model fell through to generic filler text.
    const destinations = await Destination.find({ ...districtFilter, isActive: true })
      .select('name slug type district description bestSeason')
      .limit(60)
      .lean();

    // 2. Real bookable inventory from approved operators only.
    const approvedProfiles = await OperatorProfile.find({ status: 'approved' })
      .select('user')
      .lean();
    const approvedOperatorIds = approvedProfiles.map(p => p.user);

    const listings = await Listing.find({
      ...districtFilter,
      isActive: true,
      operator: { $in: approvedOperatorIds },
    })
      .select('title category price amenities specialities district')
      .limit(40)
      .lean();

    // Context is capped and trimmed because the local fallback model reads every
    // token on CPU. Sixty destinations with 180-character notes is a prompt that
    // takes a laptop the better part of a minute just to ingest, and a trip only
    // needs a handful of places per day anyway.
    const MAX_CONTEXT_DESTINATIONS = Math.min(24, days * 4);
    const MAX_CONTEXT_LISTINGS = 12;

    const destinationContext = destinations.slice(0, MAX_CONTEXT_DESTINATIONS).map(d => ({
      slug: d.slug,
      name: d.name,
      type: d.type,
      district: d.district,
      note: (d.description || '').slice(0, 90),
    }));

    const listingContext = listings.slice(0, MAX_CONTEXT_LISTINGS).map(l => ({
      id: l._id.toString(),
      title: l.title,
      category: l.category,
      price: l.price,
      district: l.district,
    }));

    const systemInstruction = `You are an expert travel planner for Jharkhand Tourism.

Build the itinerary strictly from the real places and listings given in the context.
Rules:
- Name only places that appear in "Destinations". Never invent a place.
- Recommend only stays/guides/crafts that appear in "Listings". Never invent one.
- Group each day geographically so a traveller is not criss-crossing the state.
- Write ONE practical sentence per time slot, mentioning the actual place names. Be concise.
- "destinationSlugs" must contain slugs copied exactly from the Destinations context.
- "suggestedListingId" must be an id copied exactly from the Listings context, or null if none fits.

Respond with ONLY a valid JSON object. No markdown fences, no commentary.
"itinerary" must contain exactly ${days} entries, one per day, numbered 1 to ${days}.

{
  "itinerary": [
    {
      "day": 1,
      "title": "Short theme for the day",
      "morning": "...",
      "afternoon": "...",
      "evening": "...",
      "destinationSlugs": ["slug-one", "slug-two"],
      "suggestedListingId": "id_or_null"
    }
  ]
}`;

    // Handed to Ollama as a decoding constraint, so even a 1.5B local model
    // cannot return a single day, an array of strings, or prose around the JSON.
    const itinerarySchema = {
      type: 'object',
      properties: {
        itinerary: {
          type: 'array',
          minItems: days,
          maxItems: days,
          items: {
            type: 'object',
            properties: {
              day: { type: 'integer' },
              title: { type: 'string' },
              morning: { type: 'string' },
              afternoon: { type: 'string' },
              evening: { type: 'string' },
              // Enumerating the real slugs is what stops a small model from
              // inventing plausible-looking ones. Without it every day resolved
              // to zero destination cards even though the prose read fine.
              destinationSlugs: {
                type: 'array',
                items: destinationContext.length
                  ? { type: 'string', enum: destinationContext.map(d => d.slug) }
                  : { type: 'string' },
              },
              suggestedListingId: listingContext.length
                ? { type: ['string', 'null'], enum: [...listingContext.map(l => l.id), null] }
                : { type: ['string', 'null'] },
            },
            required: ['day', 'title', 'morning', 'afternoon', 'evening', 'destinationSlugs'],
          },
        },
      },
      required: ['itinerary'],
    };

    const prompt = `Destinations (REAL, ${destinationContext.length} available):
${JSON.stringify(destinationContext, null, 1)}

Listings (REAL, ${listingContext.length} available):
${JSON.stringify(listingContext, null, 1)}

User request:
Plan a ${days}-day trip to ${areaLabel} focused on ${interestText}.`;

    // Tier 3 fallback: still grounded in real rows, just without the prose.
    const perDay = Math.max(1, Math.ceil(destinationContext.length / days));
    const ruleBasedFallback = Array.from({ length: days }).map((_, i) => {
      const slice = destinationContext.slice(i * perDay, i * perDay + perDay).slice(0, 3);
      const names = slice.map(d => d.name);
      return {
        day: i + 1,
        title: names[0] ? `Around ${names[0]}` : `Day ${i + 1} in ${areaLabel}`,
        morning: names[0] ? `Set out early for ${names[0]}.` : `Explore ${areaLabel} at your own pace.`,
        afternoon: names[1] ? `Continue to ${names[1]}.` : `Spend the afternoon around ${areaLabel}.`,
        evening: names[2] ? `Wind down at ${names[2]} and try the local food.` : `Enjoy local cuisine in ${areaLabel}.`,
        destinationSlugs: slice.map(d => d.slug),
        suggestedListingId: listingContext[i % Math.max(1, listingContext.length)]?.id || null,
      };
    });

    // json: true switches Gemini to JSON mime type and Ollama to constrained
    // decoding, which is what makes a 4B local model reliable enough to use.
    const result = await askAI(prompt, systemInstruction, ruleBasedFallback, {
      json: true,
      schema: itinerarySchema,
      // ~220 tokens buys one day of three prose slots plus its slugs.
      maxTokens: 300 + days * 220,
    });

    let itineraryData;
    let tier = result.tier;
    try {
      itineraryData = parseItineraryJSON(result.response);
      if (!Array.isArray(itineraryData) || itineraryData.length === 0) {
        throw new Error('AI returned an empty itinerary');
      }
      // A model that returns 2 days for a 4-day trip should not cost us the
      // whole answer: keep its days and top up the rest from the rules tier.
      if (itineraryData.length < days) {
        itineraryData = [...itineraryData, ...ruleBasedFallback.slice(itineraryData.length)];
      } else if (itineraryData.length > days) {
        itineraryData = itineraryData.slice(0, days);
      }
    } catch (e) {
      console.error('Itinerary JSON parse failed:', e.message);
      itineraryData = ruleBasedFallback;
      tier = 'Rules';
    }

    // Resolve the slugs/ids the model chose back into full records, so the
    // client can render real cards instead of trusting the model's own text.
    const bySlug = new Map(destinations.map(d => [d.slug, d]));
    const byId = new Map(listings.map(l => [l._id.toString(), l]));

    const itinerary = itineraryData.map((day, idx) => {
      let slugs = Array.isArray(day.destinationSlugs) ? day.destinationSlugs : [];
      // Last resort: a day whose slugs all failed to resolve would render as a
      // card with no places on it. Borrow that day's slugs from the rules tier
      // so the traveller always gets somewhere real to go.
      if (!slugs.some(s => bySlug.has(s))) {
        slugs = ruleBasedFallback[idx]?.destinationSlugs || [];
      }
      return {
        day: day.day || idx + 1,
        title: day.title || `Day ${day.day || idx + 1}`,
        morning: day.morning || '',
        afternoon: day.afternoon || '',
        evening: day.evening || '',
        destinations: slugs
          .map(s => bySlug.get(s))
          .filter(Boolean)
          .map(d => ({ slug: d.slug, name: d.name, type: d.type, district: d.district })),
        suggestedListing: byId.get(day.suggestedListingId)
          ? {
              id: day.suggestedListingId,
              title: byId.get(day.suggestedListingId).title,
              category: byId.get(day.suggestedListingId).category,
              price: byId.get(day.suggestedListingId).price,
            }
          : null,
      };
    });

    res.json({
      tier,
      area: areaLabel,
      grounding: { destinations: destinationContext.length, listings: listingContext.length },
      itinerary,
    });
  } catch (error) {
    console.error('generateItinerary Error:', error);
    res.status(500).json({ message: 'Failed to generate itinerary' });
  }
};

/**
 * How many previous turns to replay. A local 1.5B model reads the whole prompt
 * on CPU before it emits a token, so history is bought with latency — three
 * exchanges is enough for "what about a cheaper one?" to resolve without
 * doubling the wait.
 */
const MAX_HISTORY_TURNS = 6;

const formatHistory = (history) => {
  if (!Array.isArray(history) || history.length === 0) return '';
  const turns = history
    .filter(m => m && typeof m.content === 'string' && ['user', 'assistant'].includes(m.role))
    .slice(-MAX_HISTORY_TURNS)
    .map(m => `${m.role === 'user' ? 'Tourist' : 'Assistant'}: ${m.content.slice(0, 400)}`);
  return turns.length ? `\nEarlier in this conversation:\n${turns.join('\n')}\n` : '';
};

export const chat = async (req, res) => {
  const { message, history } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ message: 'A message is required' });
  }

  try {
    // Retrieve only the rows this question is actually about. The previous
    // version pasted 200 destination names and no listings at all, which is why
    // the assistant could not answer "which homestay is good?" — the price and
    // rating it needed were never in the prompt.
    const { contextText, sources, totals } = await retrieveContext(message, history);

    const systemInstruction = `You are the assistant for the Jharkhand Tourism platform. You help tourists discover places and book verified homestays, guides, and tribal crafts.

You are bilingual: reply in Hindi if the tourist wrote in Hindi, otherwise in English.
Keep replies friendly, specific, and under 100 words.

Ground every answer in the CONTEXT below:
- Recommend only destinations and listings that appear in the context. Never invent a place, a homestay, a price, or a rating.
- When you name a listing, give its price and its rating exactly as written in the context.
- If the context does not cover what was asked, say so plainly and point the tourist to the Explore page or the AI Planner. Do not guess.
- Answer questions about how the platform works from the "About this platform" notes.

CONTEXT
${contextText}`;

    const prompt = `${formatHistory(history)}
Tourist: ${message}
Assistant:`;

    const fallbackResponse =
      "I can't reach my AI service right now. In the meantime, browse every destination and verified listing on the Explore page — it works without the AI.";

    const result = await askAI(prompt, systemInstruction, fallbackResponse, {
      maxTokens: 400,
      stop: ['\nTourist:', '\nAssistant:', 'Tourist:'],
    });

    // Gemini takes no stop sequences, so the same transcript leak is trimmed
    // here for every tier rather than only for the local one.
    const answer = String(result.response).split(/\n?\s*Tourist:/)[0].trim();

    res.json({
      tier: result.tier,
      response: result.tier === 'Rules' ? fallbackResponse : answer,
      // The rows the answer was built from. The client renders these as real
      // links rather than parsing names out of the prose — the itinerary audit
      // showed a small local model happily writing a place that is not ours.
      sources,
      grounding: totals,
    });
  } catch (error) {
    console.error('chat Error:', error);
    res.status(500).json({ message: 'Chat failed' });
  }
};

// @desc    Which AI tiers are usable right now
// @route   GET /api/ai/status
// @access  Public
//
// Lets you confirm the offline path is ready BEFORE unplugging the network,
// rather than discovering mid-demo that no local model was ever pulled.
export const status = async (req, res) => {
  try {
    res.json(await getAIStatus());
  } catch (error) {
    res.status(500).json({ message: 'Failed to read AI status' });
  }
};

export const generateDescription = async (req, res) => {
  const { category, bulletPoints } = req.body;
  try {
    const systemInstruction = `You are an expert copywriter for a tourism platform.
Take the user's rough bullet points and turn them into a single, highly compelling 3-4 sentence paragraph describing the ${category}.
DO NOT output anything other than the paragraph. Do not use quotes.`;

    const prompt = `Bullet points:
${bulletPoints}`;

    const fallbackResponse = 'A beautiful and authentic experience awaiting you in Jharkhand.';

    const result = await askAI(prompt, systemInstruction, fallbackResponse);

    res.json({
      tier: result.tier,
      description: result.tier === 'Rules' ? fallbackResponse : result.response.trim(),
    });
  } catch (error) {
    res.status(500).json({ message: 'Generation failed' });
  }
};
