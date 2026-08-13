import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

/** Preferred local model, then whatever else is installed, in order. */
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3:4b';
const OLLAMA_FALLBACK_MODELS = ['gemma3:4b', 'gemma2:2b', 'llama3.2', 'llama3.1', 'llama3', 'phi3', 'mistral', 'qwen2.5'];

/**
 * `auto` (default) walks the tiers in order. Force a single tier with
 * AI_PROVIDER=gemini | ollama | rules — setting `ollama` is the honest way to
 * rehearse an offline demo without unplugging anything.
 */
const AI_PROVIDER = (process.env.AI_PROVIDER || 'auto').toLowerCase();

const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 20000;
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS) || 120000;
const OLLAMA_PROBE_MS = 1500;
const REACHABILITY_MS = Number(process.env.REACHABILITY_TIMEOUT_MS) || 1500;

/**
 * Is Google actually reachable right now?
 *
 * Without this, an unplugged network costs a full GEMINI_TIMEOUT_MS of dead air
 * before the local model even starts — twenty seconds of a blank screen, which is
 * exactly what made the offline fallback look broken. A 1.5s HEAD request answers
 * the same question, and a false negative is harmless: we just use the local model.
 */
const isOnline = async () => {
  try {
    await fetch('https://generativelanguage.googleapis.com/', {
      method: 'HEAD',
      signal: AbortSignal.timeout(REACHABILITY_MS),
    });
    return true;
  } catch {
    return false;
  }
};

/**
 * The Gemini SDK takes no abort signal, so a dead network can leave the request
 * hanging on TCP retries for a minute or more. Racing it against a timer is
 * what makes the offline fallback feel immediate instead of frozen.
 */
const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);

/** Which models the local Ollama daemon actually has pulled. Empty if it is not running. */
export const getOllamaModels = async (timeoutMs = OLLAMA_PROBE_MS) => {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map(m => m.name);
  } catch {
    return [];
  }
};

/** Pick the configured model if present, else the best installed alternative. */
const chooseOllamaModel = (installed) => {
  if (installed.length === 0) return null;
  const has = (name) => installed.find(m => m === name || m.startsWith(`${name}:`));
  return has(OLLAMA_MODEL)
    || OLLAMA_FALLBACK_MODELS.map(has).find(Boolean)
    || installed[0];
};

const callGemini = async (prompt, systemInstruction, json) => {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction,
    ...(json ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
  });
  const result = await withTimeout(model.generateContent(prompt), GEMINI_TIMEOUT_MS, 'Gemini');
  return result.response.text();
};

const callOllama = async (prompt, systemInstruction, json, schema, maxTokens, stop) => {
  const installed = await getOllamaModels();
  const model = chooseOllamaModel(installed);
  if (!model) throw new Error('Ollama is not running, or has no models pulled');

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
    body: JSON.stringify({
      model,
      prompt,
      system: systemInstruction,
      stream: false,
      // Constrained decoding. A bare `format: 'json'` only guarantees *some*
      // valid JSON — a 1.5B model asked for an array of days happily returns a
      // single day object instead, which is what silently broke the offline
      // planner. Passing a schema (Ollama >= 0.5) pins the exact shape.
      ...(schema ? { format: schema } : json ? { format: 'json' } : {}),
      options: {
        // Lower temperature and a tighter token budget. A local model on a laptop
        // generates a few tokens a second, so every token in the budget is time an
        // audience spends watching a spinner — and an itinerary needs prose, not
        // an essay. This is the difference between ~36s and something demoable.
        temperature: json ? 0.3 : 0.7,
        // A truncated response is invalid JSON, which drops the whole request to
        // the rules tier — so callers that ask for many days must raise this.
        num_predict: maxTokens || (json ? 900 : 1200),
        num_ctx: 4096,
        top_k: 20,
        top_p: 0.8,
        // A transcript-style prompt invites a small model to keep writing past
        // its own turn and answer questions the tourist never asked. Callers
        // that format a dialogue pass the speaker labels here to cut it off.
        ...(stop?.length ? { stop } : {}),
      },
      keep_alive: '30m',
    }),
  });

  if (!res.ok) throw new Error(`Ollama responded with ${res.status}`);
  const data = await res.json();
  if (!data.response) throw new Error('Ollama returned an empty response');
  return { text: data.response, model };
};

/**
 * Three-tier AI with graceful degradation.
 *
 *   Tier 1  Gemini          — needs an API key and internet
 *   Tier 2  Ollama          — fully local, works with the network unplugged
 *   Tier 3  Rules           — no model at all; deterministic, still grounded
 *                             in real destinations from our own database
 *
 * Never throws: the rules tier is always a valid answer.
 */
export const askAI = async (prompt, systemInstruction = '', rulesFallbackData = {}, options = {}) => {
  const { json = false, schema = null, maxTokens = 0, stop = null } = options;
  const tryGemini = genAI && (AI_PROVIDER === 'auto' || AI_PROVIDER === 'gemini');
  const tryOllama = AI_PROVIDER === 'auto' || AI_PROVIDER === 'ollama';

  if (tryGemini) {
    // Check the network before committing to the slow path. Skipping straight to
    // the local model when we already know we are offline is what turns a 20s
    // stall into a ~1s handover.
    if (await isOnline()) {
      try {
        return { response: await callGemini(prompt, systemInstruction, json || Boolean(schema)), tier: 'Gemini' };
      } catch (err) {
        console.error(`Gemini unavailable (${err.message}) — falling back to Ollama.`);
      }
    } else {
      console.warn('No route to Gemini — going straight to the local model.');
    }
  }

  if (tryOllama) {
    try {
      const { text, model } = await callOllama(prompt, systemInstruction, json, schema, maxTokens, stop);
      return { response: text, tier: 'Ollama', model };
    } catch (err) {
      console.error(`Ollama unavailable (${err.message}) — falling back to rules.`);
    }
  }

  return { response: JSON.stringify(rulesFallbackData), tier: 'Rules' };
};

/** Which tiers are usable right now. Powers GET /api/ai/status. */
export const getAIStatus = async () => {
  const models = await getOllamaModels();
  return {
    provider: AI_PROVIDER,
    gemini: { configured: Boolean(genAI) },
    ollama: {
      url: OLLAMA_URL,
      running: models.length > 0,
      models,
      selected: chooseOllamaModel(models),
      preferred: OLLAMA_MODEL,
    },
    offlineCapable: models.length > 0,
  };
};

/**
 * Strip markdown fences a model may wrap JSON in.
 */
export const cleanJSON = (text) => {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/, '');
  if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```/, '');
  if (cleaned.endsWith('```')) cleaned = cleaned.replace(/```$/, '');
  return cleaned.trim();
};
