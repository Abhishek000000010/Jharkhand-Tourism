/**
 * Report which AI tier will answer right now, and prove the fallback is fast.
 *
 *   node scripts/checkAI.js            # current configuration
 *   AI_PROVIDER=ollama node scripts/checkAI.js   # rehearse the offline path
 *
 * Run this BEFORE unplugging the network for a demo.
 */
import { askAI, getAIStatus } from '../services/aiService.js';

const status = await getAIStatus();
console.log('\nAI status');
console.log('  provider        :', status.provider);
console.log('  Gemini key set  :', status.gemini.configured);
console.log('  Ollama running  :', status.ollama.running);
console.log('  Ollama models   :', status.ollama.models.join(', ') || '(none)');
console.log('  model selected  :', status.ollama.selected || '(none)');
console.log('  works offline   :', status.offlineCapable ? 'YES' : 'NO — install Ollama and pull a model');

const t0 = Date.now();
const result = await askAI(
  'Reply with JSON: [{"day":1,"morning":"test"}]',
  'You return only JSON.',
  [{ day: 1, morning: 'Rule-based fallback' }],
  { json: true }
);
console.log(`\n  answered by     : ${result.tier}${result.model ? ` (${result.model})` : ''}`);
console.log(`  round trip      : ${Date.now() - t0} ms`);
console.log(`  response        : ${String(result.response).replace(/\s+/g, ' ').slice(0, 140)}\n`);
