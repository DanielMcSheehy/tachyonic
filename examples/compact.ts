/**
 * Example: Compact context compression
 * 
 * Compress chat history or code using local TF-IDF algorithm
 * Zero API calls - runs entirely locally.
 */
import { AIEditSDK } from '@tachyonic/ai-edit-sdk';

const sdk = new AIEditSDK();

async function main() {
  // Long chat history
  const chatHistory = `
User: Hello, how are you?
Assistant: I'm doing well! How can I help?
User: I need help with authentication.
... 100 more messages ...
User: Specifically, how do I validate JWT tokens in Node.js?
`;

  // Compress with query focus
  const result = await sdk.compact.compact({
    input: chatHistory,
    query: 'JWT token validation in Node.js',
    compressionRatio: 0.4, // Keep 40%
  });

  const reduction = ((1 - result.usage.compressionRatio) * 100).toFixed(1);
  console.log(`✅ Compressed ${reduction}% (${result.usage.inputTokens} → ${result.usage.outputTokens} tokens)`);
  console.log(`\nPreserved content:\n${result.output.slice(0, 800)}...`);
}

main().catch(console.error);
