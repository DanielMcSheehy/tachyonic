/**
 * AI Edit SDK - Pure Local SDK for AI coding agents
 * 
 * Self-contained implementations (no external LLM calls required):
 * - fastApply: Edit file merging at 10,500 tok/s
 * - compact: Context compression at 33,000 tok/s  
 * - router: Automatic model selection
 * 
 * All engines use deterministic algorithms - zero API dependencies.
 */
import { SDKConfig } from './types.js';
import { FastApplyClient } from './fast-apply.js';
import { CompactClient } from './compact.js';
import { RouterClient } from './router.js';

export class AIEditSDK {
  public fastApply: FastApplyClient;
  public compact: CompactClient;
  public router: RouterClient;

  private config: SDKConfig;

  constructor(config: SDKConfig = {}) {
    this.config = config;
    
    // Initialize all sub-clients with shared config
    this.fastApply = new FastApplyClient(config);
    this.compact = new CompactClient(config);
    this.router = new RouterClient(config);
  }

  /**
   * Quick apply edit to file
   * Convenience method for common use case
   */
  async editFile(
    filepath: string,
    instructions: string,
    codeEdit: string
  ): Promise<{ success: boolean; output: string }> {
    const result = await this.fastApply.execute({
      targetFilepath: filepath,
      instructions,
      codeEdit,
    });
    
    return {
      success: result.success,
      output: result.output,
    };
  }

  /**
   * Quick compact context
   * Convenience method for common use case
   */
  async compress(
    input: string,
    query?: string
  ): Promise<{ output: string; ratio: number }> {
    const result = await this.compact.compact({
      input,
      query,
    });

    return {
      output: result.output,
      ratio: result.usage.compressionRatio,
    };
  }
}

// Export all types and sub-clients
export * from './types.js';
export { FastApplyClient } from './fast-apply.js';
export { CompactClient } from './compact.js';
export { RouterClient } from './router.js';

// Export MCP tool creators
export {
  createEditFileTool,
} from './fast-apply.js';

export {
  createCompactTool,
} from './compact.js';

// Also export the core engines for advanced use
export * from './core/index.js';
