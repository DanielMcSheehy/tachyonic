/**
 * Router Engine Example - Prompt Classification
 * 
 * This demonstrates the heuristic-based classification algorithm
 * that routes prompts to model tiers WITHOUT calling any external API.
 */
import { route, batchRoute, getModelForTier, smartRoute } from '../src/core';

console.log('=== Router Engine Demo ===\n');

// Example 1: Simple prompts
console.log('1. Simple Prompts (Fast Tier)');
console.log('=============================');

const simplePrompts = [
  'Say hello',
  'What is 2+2?',
  'Convert this to lowercase: HELLO',
  'Capitalize the first letter',
];

for (const prompt of simplePrompts) {
  const result = route(prompt);
  console.log(`\n"${prompt}"`);
  console.log(`  → ${result.tier} tier (${(result.confidence * 100).toFixed(0)}% confidence)`);
  console.log(`  Model: ${getModelForTier(result.tier, { provider: 'anthropic' })}`);
  console.log(`  Est. cost: $${result.estimatedCost.toFixed(4)}`);
}

// Example 2: Complex reasoning
console.log('\n\n2. Complex Reasoning (Powerful Tier)');
console.log('=====================================');

const complexPrompts = [
  'Debug this distributed system memory leak under high load',
  'Design a microservices architecture for a fintech platform',
  'Analyze the time complexity of this recursive algorithm',
  'Refactor this 500-line module to use clean architecture patterns',
];

for (const prompt of complexPrompts) {
  const result = route(prompt);
  console.log(`\n"${prompt.slice(0, 60)}..."`);
  console.log(`  → ${result.tier} tier (${(result.confidence * 100).toFixed(0)}% confidence)`);
  console.log(`  Reasoning: ${result.reasoning}`);
  console.log(`  Latency: ${result.latency}`);
}

// Example 3: Code detection
console.log('\n\n3. Code Detection & Language Identification');
console.log('===========================================');

const codePrompts = [
  {
    name: 'TypeScript',
    prompt: `Fix this function:
    function calculateTotal(items: Item[]): number {
      return items.reduce((sum, item) => sum + item.price, 0);
    }`,
  },
  {
    name: 'Python',
    prompt: `Debug this class:
    class UserManager:
        def __init__(self):
            self.users = []
        
        def get_user(self, user_id: str) -> User:
            return next((u for u in self.users if u.id == user_id), None)`,
  },
  {
    name: 'Rust',
    prompt: `Optimize this:
    pub fn process_data(data: Vec<String>) -> Vec<String> {
        data.iter().filter(|s| !s.is_empty()).cloned().collect()
    }`,
  },
];

for (const { name, prompt } of codePrompts) {
  const result = route(prompt);
  console.log(`\n${name}:`);
  console.log(`  Detected languages: ${result.features.languages.join(', ') || 'none'}`);
  console.log(`  Has code: ${result.features.hasCode}`);
  console.log(`  Routed to: ${result.tier}`);
}

// Example 4: Batch routing
console.log('\n\n4. Batch Routing');
console.log('================');

const batchPrompts = [
  'Hello!',
  'Create a React component with TypeScript',
  'Debug memory leak in async code',
  'What is the weather?',
  'Design distributed system architecture',
];

const batchResults = batchRoute(batchPrompts);

console.log('\nBatch results:');
batchResults.forEach((result, i) => {
  console.log(`  ${i + 1}. "${batchPrompts[i].slice(0, 30)}..." → ${result.tier}`);
});

// Example 5: Smart routing with history
console.log('\n\n5. Smart Routing with Success History');
console.log('======================================');

const history = [
  { prompt: 'simple task', tier: 'fast' as const, success: true },
  { prompt: 'simple task 2', tier: 'fast' as const, success: true },
  { prompt: 'complex debug', tier: 'fast' as const, success: false },
  { prompt: 'complex debug', tier: 'balanced' as const, success: true },
];

const smartResult = smartRoute('debug this issue', history);
console.log('\nWith history showing fast tier fails for debug tasks:');
console.log(`  Smart route: ${smartResult.tier}`);
console.log(`  Reasoning: ${smartResult.reasoning}`);

// Example 6: Prefer speed vs quality
console.log('\n\n6. Speed vs Quality Preferences');
console.log('===============================');

const architecturePrompt = 'Design a scalable microservices architecture for an e-commerce platform';

const normal = route(architecturePrompt);
const preferSpeed = route(architecturePrompt, { preferSpeed: true });
const preferQuality = route(architecturePrompt, { preferQuality: true });

console.log(`\nPrompt: "${architecturePrompt.slice(0, 50)}..."`);
console.log(`  Normal:        ${normal.tier} ($${normal.estimatedCost.toFixed(3)})`);
console.log(`  Prefer Speed:  ${preferSpeed.tier} ($${preferSpeed.estimatedCost.toFixed(3)})`);
console.log(`  Prefer Quality: ${preferQuality.tier} ($${preferQuality.estimatedCost.toFixed(3)})`);

console.log('\n\n✨ Router uses deterministic heuristics - no LLM calls required!');
console.log('Features: complexity scoring, code detection, language identification');
