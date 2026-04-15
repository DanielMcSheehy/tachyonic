/**
 * Example: Router - automatic model selection
 * 
 * Route prompts to the appropriate model tier using local heuristics
 * Zero API calls - runs entirely locally.
 */
import { AIEditSDK } from '@tachyonic/ai-edit-sdk';

const sdk = new AIEditSDK();

async function main() {
  const prompts = [
    'Say hello',
    'Refactor this 500-line authentication module to use OAuth2',
    'Debug why my distributed system is losing messages under high load',
  ];

  for (const prompt of prompts) {
    const route = await sdk.router.route({ prompt });
    
    console.log(`\n📝 "${prompt.slice(0, 50)}..."`);
    console.log(`   → ${route.selectedModel} (${route.tier})`);
    console.log(`   Confidence: ${(route.confidence * 100).toFixed(0)}%`);
    console.log(`   Est. cost: $${route.estimatedCost.toFixed(3)}`);
  }
}

main().catch(console.error);
