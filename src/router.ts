/**
 * Router - Local heuristic model selection
 * 
 * Pure algorithm implementation using the router-engine.
 * Zero API calls - runs entirely locally with deterministic heuristics.
 * 
 * Analyzes prompts and routes to the appropriate model tier (fast/balanced/powerful).
 * ~0.006ms routing, $0 cost.
 */
import {
  RouterInput,
  RouterResult,
  ModelTier,
  ChatMessage,
} from './types.js';
import { route as engineRoute, batchRoute as engineBatchRoute, getModelForTier as engineGetModelForTier } from './core/router-engine.js';

// Model tier mappings
const TIER_MODELS: Record<ModelTier, string[]> = {
  fast: ['gpt-4o-mini', 'claude-3-haiku'],
  balanced: ['gpt-4o', 'claude-3-sonnet'],
  powerful: ['claude-3-opus', 'gpt-4-turbo'],
};

const TIER_COSTS: Record<ModelTier, number> = {
  fast: 0.001,
  balanced: 0.01,
  powerful: 0.03,
};

export class RouterClient {
  private config: { debug?: boolean };

  constructor(config: { debug?: boolean } = {}) {
    this.config = config;
  }

  /**
   * Route a prompt to the appropriate model tier using local heuristics
   * 
   * Example:
   * ```typescript
   * const route = await client.route({
   *   prompt: "Refactor this authentication middleware to use JWT"
   * });
   * // route.selectedModel = "claude-3-sonnet"
   * // route.tier = "balanced"
   * ```
   */
  async route(input: RouterInput): Promise<RouterResult> {
    const startTime = Date.now();

    // If tier is forced, use it directly
    if (input.tier) {
      const model = TIER_MODELS[input.tier][0];
      return {
        selectedModel: model,
        tier: input.tier,
        confidence: 1.0,
        reasoning: `User forced ${input.tier} tier`,
        estimatedCost: TIER_COSTS[input.tier],
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          processingTimeMs: Date.now() - startTime,
        },
      };
    }

    // Use the local engine for heuristic classification
    const engineResult = engineRoute(input.prompt);
    const processingTimeMs = Date.now() - startTime;

    // Map engine tier to recommended model
    const selectedModel = TIER_MODELS[engineResult.tier][0];
    
    return {
      selectedModel,
      tier: engineResult.tier,
      confidence: engineResult.confidence,
      reasoning: engineResult.reasoning,
      estimatedCost: TIER_COSTS[engineResult.tier],
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        processingTimeMs,
      },
    };
  }

  /**
   * Batch route multiple prompts
   */
  async batchRoute(prompts: string[]): Promise<RouterResult[]> {
    return Promise.all(prompts.map(p => this.route({ prompt: p })));
  }

  /**
   * Smart route with adaptive cost estimation
   */
  async smartRoute(input: RouterInput & {
    budgetLimit?: number;
    latencyTarget?: 'fast' | 'balanced' | 'low';
  }): Promise<RouterResult & { withinBudget: boolean }> {
    const baseRoute = await this.route(input);
    
    let selectedModel = baseRoute.selectedModel;
    let selectedTier = baseRoute.tier;
    
    // Adjust for budget
    if (input.budgetLimit && baseRoute.estimatedCost > input.budgetLimit) {
      // Downgrade tier
      const tiers: ModelTier[] = ['powerful', 'balanced', 'fast'];
      const currentIdx = tiers.indexOf(baseRoute.tier);
      for (let i = currentIdx + 1; i < tiers.length; i++) {
        if (TIER_COSTS[tiers[i]] <= input.budgetLimit) {
          selectedTier = tiers[i];
          selectedModel = TIER_MODELS[tiers[i]][0];
          break;
        }
      }
    }

    // Adjust for latency
    if (input.latencyTarget === 'fast' && selectedTier !== 'fast') {
      selectedTier = 'fast';
      selectedModel = TIER_MODELS.fast[0];
    }

    const withinBudget = TIER_COSTS[selectedTier] <= (input.budgetLimit ?? Infinity);

    return {
      ...baseRoute,
      selectedModel,
      tier: selectedTier,
      estimatedCost: TIER_COSTS[selectedTier],
      withinBudget,
    };
  }

  /**
   * Get model for tier
   */
  static getModelForTier(tier: ModelTier, preferred?: string): string {
    if (preferred && TIER_MODELS[tier].includes(preferred)) {
      return preferred;
    }
    return TIER_MODELS[tier][0];
  }

  /**
   * Estimate cost for tier
   */
  static estimateCost(tier: ModelTier, inputTokens: number, outputTokens: number): number {
    const baseCost = TIER_COSTS[tier];
    // Rough per-token cost estimate
    const per1kCost = tier === 'fast' ? 0.0001 : tier === 'balanced' ? 0.001 : 0.003;
    return baseCost + ((inputTokens + outputTokens) / 1000) * per1kCost;
  }
}
