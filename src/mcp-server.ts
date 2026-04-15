/**
 * MCP Server integration for Morph SDK
 * 
 * Provides tools for Claude Desktop, Cursor, VS Code, etc.
 * 
 * Usage:
 * ```json
 * // claude_desktop_config.json
 * {
 *   "mcpServers": {
 *     "morph": {
 *       "command": "npx",
 *       "args": ["-y", "@morph-reverse/mcp"],
 *       "env": {
 *         "MORPH_API_KEY": "your-api-key"
 *       }
 *     }
 *   }
 * }
 * ```
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { MorphClient } from './index.js';

const morph = new MorphClient({
  apiKey: process.env.MORPH_API_KEY,
  debug: process.env.DEBUG === 'true',
});

const server = new Server(
  {
    name: 'morph-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'edit_file',
        description: `Apply an AI-generated edit to a file using Fast Apply (10,500 tok/s, 98% accuracy).

Edit snippets must use '// ... existing code ...' markers to indicate unchanged sections:

// ... existing code ...
const newCode = "example";
// ... existing code ...`,
        inputSchema: {
          type: 'object',
          properties: {
            target_filepath: {
              type: 'string',
              description: 'Absolute path to the file to edit',
            },
            instructions: {
              type: 'string',
              description: 'Natural language description of the change',
            },
            code_edit: {
              type: 'string',
              description: 'Edit snippet with // ... existing code ... markers showing only changed lines',
            },
          },
          required: ['target_filepath', 'instructions', 'code_edit'],
        },
      },
      {
        name: 'compact_context',
        description: `Compress chat history or code context at 33,000 tok/s (50-70% reduction).

Removes irrelevant lines while preserving important content. Use before sending long contexts to your LLM.`,
        inputSchema: {
          type: 'object',
          properties: {
            input: {
              type: 'string',
              description: 'Text or code to compress',
            },
            query: {
              type: 'string',
              description: 'Focus query for relevance-based pruning (e.g., "database connection")',
            },
            compression_ratio: {
              type: 'number',
              description: 'Fraction to keep, 0.3-0.7 (default: 0.5)',
            },
          },
          required: ['input'],
        },
      },
      {
        name: 'route_prompt',
        description: `Route a prompt to the optimal model tier (fast/balanced/powerful).

Analyzes complexity and selects appropriate model for cost/quality tradeoff.`,
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'Prompt to analyze',
            },
            force_tier: {
              type: 'string',
              enum: ['fast', 'balanced', 'powerful'],
              description: 'Force specific tier (optional)',
            },
          },
          required: ['prompt'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'edit_file': {
        const { target_filepath, instructions, code_edit } = args as {
          target_filepath: string;
          instructions: string;
          code_edit: string;
        };
        
        const result = await morph.fastApply.execute({
          targetFilepath: target_filepath,
          instructions,
          codeEdit: code_edit,
        });

        return {
          content: [
            {
              type: 'text',
              text: result.success
                ? `✅ Edit applied successfully (${result.usage.processingTimeMs}ms, ${result.usage.outputTokens} tokens)`
                : `❌ Edit failed - snippet may need adjustment`,
            },
            {
              type: 'text',
              text: result.output.slice(0, 3000),
            },
          ],
        };
      }

      case 'compact_context': {
        const { input, query, compression_ratio } = args as {
          input: string;
          query?: string;
          compression_ratio?: number;
        };

        const result = await morph.compact.compact({
          input,
          query,
          compressionRatio: compression_ratio,
        });

        const reduction = ((1 - result.usage.compressionRatio) * 100).toFixed(1);

        return {
          content: [
            {
              type: 'text',
              text: `✅ Compressed ${reduction}% (${result.usage.inputTokens} → ${result.usage.outputTokens} tokens, ${result.usage.processingTimeMs}ms)`,
            },
            {
              type: 'text',
              text: result.output.slice(0, 3000),
            },
          ],
        };
      }

      case 'route_prompt': {
        const { prompt, force_tier } = args as {
          prompt: string;
          force_tier?: 'fast' | 'balanced' | 'powerful';
        };

        const result = await morph.router.route({
          prompt,
          tier: force_tier,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Routed to: **${result.selectedModel}** (${result.tier} tier)

Confidence: ${(result.confidence * 100).toFixed(0)}%
Estimated cost: $${result.estimatedCost.toFixed(3)}

Reasoning: ${result.reasoning}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Morph MCP server running on stdio');
}

main().catch(console.error);
