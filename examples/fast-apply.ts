/**
 * Example: Basic Fast Apply usage
 * 
 * Apply an AI-generated edit to a file with deterministic merge
 * Zero API calls - runs entirely locally.
 */
import { AIEditSDK } from '@tachyonic/ai-edit-sdk';

const sdk = new AIEditSDK();

async function main() {
  // Apply an edit to a file
  const result = await sdk.fastApply.applyAndSave({
    targetFilepath: './src/auth.ts',
    instructions: 'Add null check before accessing user property',
    codeEdit: `
// ... existing code ...
if (!user) {
  throw new Error('User not authenticated');
}
// ... existing code ...
`,
  });

  if (result.saved) {
    console.log(`✅ Edit applied and saved (${result.usage.processingTimeMs}ms)`);
    console.log(result.output.slice(0, 500));
  }
}

main().catch(console.error);