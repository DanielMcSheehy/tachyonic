/**
 * Router Engine - Prompt Classification for Model Selection
 * 
 * Reverse-engineered from Morph's Router architecture.
 * 
 * Algorithm:
 * 1. Extract features from prompt (length, complexity indicators, task type)
 * 2. Score prompt across dimensions:
 *    - Code complexity (lines, nesting depth, language features)
 *    - Reasoning depth (planning, analysis, debugging keywords)
 *    - Creative requirement (generation vs modification)
 * 3. Map to model tier based on weighted scoring
 * 4. Return tier + confidence + reasoning
 * 
 * No LLM call required - deterministic heuristics.
 */

export type ModelTier = 'fast' | 'balanced' | 'powerful';

export interface RouterConfig {
  /** Prefer speed over quality (default: false) */
  preferSpeed?: boolean;
  /** Prefer quality over cost (default: false) */
  preferQuality?: boolean;
  /** Custom tier thresholds (0-1 scores) */
  thresholds?: {
    fastToBalanced: number;
    balancedToPowerful: number;
  };
  /** Context messages for routing decision */
  messages?: Array<{ role: string; content: string }>;
}

export interface RouterResult {
  tier: ModelTier;
  confidence: number;
  reasoning: string;
  features: PromptFeatures;
  estimatedCost: number;
  estimatedTokens: { input: number; output: number };
  latency: 'fast' | 'medium' | 'slow';
}

export interface PromptFeatures {
  /** Total length in characters */
  length: number;
  /** Approximate token count */
  tokenEstimate: number;
  /** Code-related keywords detected */
  hasCode: boolean;
  /** Complex reasoning keywords */
  requiresDeepReasoning: boolean;
  /** Debugging/troubleshooting context */
  isDebugging: boolean;
  /** Creative generation vs modification */
  isCreative: boolean;
  /** Architecture/design level task */
  isArchitectural: boolean;
  /** Multi-step or planning required */
  requiresPlanning: boolean;
  /** Specific domain (math, science, etc.) */
  domain?: string;
  /** Detected programming languages */
  languages: string[];
}

// Model tier costs (per 1K tokens)
const TIER_COSTS: Record<ModelTier, { input: number; output: number }> = {
  fast: { input: 0.0001, output: 0.0002 },
  balanced: { input: 0.003, output: 0.006 },
  powerful: { input: 0.015, output: 0.075 },
};

const TIER_LATENCIES: Record<ModelTier, RouterResult['latency']> = {
  fast: 'fast',
  balanced: 'medium',
  powerful: 'slow',
};

// Complexity indicators
const COMPLEXITY_INDICATORS = {
  // Deep reasoning keywords
  reasoning: [
    'analyze', 'debug', 'investigate', 'troubleshoot', 'optimize',
    'refactor', 'redesign', 'architecture', 'pattern', 'algorithm',
    'complex', 'performance', 'memory leak', 'race condition',
    'distributed', 'concurrency', 'threading', 'async',
    'deep dive', 'root cause', 'performance bottleneck',
  ],

  // Creative/generation tasks
  creative: [
    'create', 'generate', 'build from scratch', 'implement new',
    'design', 'invent', 'novel', 'original', 'greenfield',
  ],

  // Debugging indicators
  debugging: [
    'fix', 'bug', 'error', 'exception', 'crash', 'broken',
    'not working', 'fails', 'issue', 'problem', 'wrong output',
    'debug', 'trace', 'stack trace', 'breakpoint',
  ],

  // Architectural
  architectural: [
    'system design', 'architecture', 'microservices', 'scalable',
    'database schema', 'api design', 'integration', 'migration',
    'rewriting', 'modernizing', 'tech stack', 'infrastructure',
  ],

  // Planning/multi-step
  planning: [
    'plan', 'step by step', 'multi-step', 'implement in stages',
    'roadmap', 'milestone', 'incremental', 'phased',
    'requires multiple files', 'cross-module', 'dependency',
  ],
};

// Language detection patterns
const LANGUAGE_PATTERNS: Record<string, RegExp> = {
  typescript: /\b(interface|type|const.*:.*=|<.*> extends|async.*:\s*\w+.*=>)\b/,
  javascript: /\b(const|let|var)\s+\w+\s*=\s*.*=>|\bfunction\s*\w*\s*\([^)]*\)\s*{/,
  python: /\b(def|class|import|from)\s+\w+|\s*:\s*(str|int|list|dict)\b/,
  rust: /\b(fn|struct|impl|trait|let\s+mut|match\s+\w+\s*\{)\b/,
  go: /\bfunc\s+\w*\s*\([^)]*\)\s*(?:\w+)?\s*\{/,
  java: /\b(public|private)\s+(?:static\s+)?(?:void|\w+)\s+\w+\s*\(/,
  cpp: /\b#include\s*<|\bstd::|\b(int|void|bool)\s+\w+\s*\(/,
  sql: /\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|JOIN|WHERE)\b/i,
};

/**
 * THE CORE ROUTER ALGORITHM
 * 
 * Deterministic prompt classification without LLM calls.
 */
export function route(
  prompt: string,
  config: RouterConfig = {}
): RouterResult {
  const {
    preferSpeed = false,
    preferQuality = false,
    thresholds = { fastToBalanced: 0.4, balancedToPowerful: 0.7 },
    messages = [],
  } = config;

  // Combine prompt with recent context
  const fullContext = [
    ...messages.slice(-3).map(m => m.content),
    prompt,
  ].join('\n\n');

  // Extract features
  const features = extractFeatures(fullContext);

  // Calculate complexity score (0-1)
  const complexityScore = calculateComplexityScore(features);

  // Determine tier
  let tier: ModelTier;
  let confidence: number;

  if (preferSpeed) {
    tier = complexityScore < thresholds.balancedToPowerful ? 'fast' : 'balanced';
    confidence = 0.7;
  } else if (preferQuality) {
    tier = complexityScore > thresholds.fastToBalanced ? 'powerful' : 'balanced';
    confidence = 0.8;
  } else {
    // Balanced selection
    if (complexityScore < thresholds.fastToBalanced) {
      tier = 'fast';
      confidence = 1 - (complexityScore / thresholds.fastToBalanced);
    } else if (complexityScore < thresholds.balancedToPowerful) {
      tier = 'balanced';
      confidence = 1 - Math.abs(complexityScore - (thresholds.fastToBalanced + thresholds.balancedToPowerful) / 2) / 0.3;
    } else {
      tier = 'powerful';
      confidence = complexityScore;
    }
  }

  // Calculate cost estimate
  const estimatedTokens = {
    input: features.tokenEstimate,
    output: estimateOutputTokens(features),
  };

  const costEstimate =
    (estimatedTokens.input / 1000) * TIER_COSTS[tier].input +
    (estimatedTokens.output / 1000) * TIER_COSTS[tier].output;

  // Generate reasoning
  const reasoning = generateReasoning(features, tier, complexityScore);

  return {
    tier,
    confidence: Math.min(Math.max(confidence, 0), 1),
    reasoning,
    features,
    estimatedCost: Math.round(costEstimate * 1000) / 1000,
    estimatedTokens,
    latency: TIER_LATENCIES[tier],
  };
}

/**
 * Extract features from prompt text
 */
function extractFeatures(text: string): PromptFeatures {
  const lowerText = text.toLowerCase();
  const lines = text.split('\n');

  // Detect languages
  const languages: string[] = [];
  for (const [lang, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
    if (pattern.test(text)) {
      languages.push(lang);
    }
  }

  // Check complexity indicators
  const hasComplexity = (keywords: string[]): boolean =>
    keywords.some(k => lowerText.includes(k.toLowerCase()));

  const requiresDeepReasoning = hasComplexity(COMPLEXITY_INDICATORS.reasoning);
  const isDebugging = hasComplexity(COMPLEXITY_INDICATORS.debugging);
  const isCreative = hasComplexity(COMPLEXITY_INDICATORS.creative);
  const isArchitectural = hasComplexity(COMPLEXITY_INDICATORS.architectural);
  const requiresPlanning = hasComplexity(COMPLEXITY_INDICATORS.planning);

  // Has code blocks
  const hasCode =
    text.includes('```') ||
    text.includes('    ') || // Indented code
    /\b(function|class|const|let|var|if|for|while|return)\b/.test(text);

  // Detect domain
  let domain: string | undefined;
  if (/\b(math|equation|calculate|formula|algorithm)\b/i.test(text)) {
    domain = 'mathematics';
  } else if (/\b(science|physics|chemistry|biology)\b/i.test(text)) {
    domain = 'science';
  } else if (languages.length > 0) {
    domain = 'programming';
  }

  return {
    length: text.length,
    tokenEstimate: Math.ceil(text.length / 4),
    hasCode,
    requiresDeepReasoning,
    isDebugging,
    isCreative,
    isArchitectural,
    requiresPlanning,
    domain,
    languages,
  };
}

/**
 * Calculate overall complexity score (0-1)
 */
function calculateComplexityScore(features: PromptFeatures): number {
  let score = 0;
  const weights: Record<string, number> = {
    length: 0.1,
    reasoning: 0.25,
    debugging: 0.2,
    creative: 0.15,
    architectural: 0.2,
    planning: 0.1,
  };

  // Length factor (longer prompts tend to need more context)
  if (features.tokenEstimate > 2000) score += weights.length;
  else if (features.tokenEstimate > 1000) score += weights.length * 0.5;

  // Complexity indicators
  if (features.requiresDeepReasoning) score += weights.reasoning;
  if (features.isDebugging) score += weights.debugging;
  if (features.isCreative) score += weights.creative;
  if (features.isArchitectural) score += weights.architectural;
  if (features.requiresPlanning) score += weights.planning;

  // Code complexity boost
  if (features.hasCode && features.languages.length > 0) {
    score += 0.1;
  }

  // Multiple languages = more complex
  if (features.languages.length > 1) {
    score += 0.1;
  }

  return Math.min(score, 1);
}

/**
 * Estimate output tokens based on task type
 */
function estimateOutputTokens(features: PromptFeatures): number {
  let baseEstimate = features.tokenEstimate * 0.5; // Default compression

  if (features.isCreative) {
    baseEstimate = Math.max(baseEstimate, 1000); // Generating code is longer
  }

  if (features.isArchitectural) {
    baseEstimate = Math.max(baseEstimate, 1500); // Architecture responses are detailed
  }

  if (features.requiresDeepReasoning) {
    baseEstimate = Math.max(baseEstimate, 800); // Analysis needs explanation
  }

  return Math.ceil(baseEstimate);
}

/**
 * Generate human-readable reasoning
 */
function generateReasoning(
  features: PromptFeatures,
  tier: ModelTier,
  score: number
): string {
  const reasons: string[] = [];

  if (features.languages.length > 0) {
    reasons.push(`Detected code in ${features.languages.join(', ')}`);
  }

  if (features.requiresDeepReasoning) {
    reasons.push('Requires complex reasoning/analysis');
  }

  if (features.isDebugging) {
    reasons.push('Debugging/troubleshooting task');
  }

  if (features.isArchitectural) {
    reasons.push('Architecture/design level task');
  }

  if (features.isCreative) {
    reasons.push('Creative generation task');
  }

  if (features.requiresPlanning) {
    reasons.push('Multi-step planning required');
  }

  if (features.tokenEstimate > 2000) {
    reasons.push('Large context provided');
  }

  const tierReason: Record<ModelTier, string> = {
    fast: 'Simple task, optimized for speed and cost',
    balanced: 'Moderate complexity, balanced quality/speed',
    powerful: 'Complex task requiring deep reasoning',
  };

  return reasons.length > 0
    ? `${tierReason[tier]}. ${reasons.join('; ')}`
    : tierReason[tier];
}

/**
 * Batch route multiple prompts
 */
export function batchRoute(
  prompts: string[],
  config?: RouterConfig
): RouterResult[] {
  return prompts.map(p => route(p, config));
}

/**
 * Get recommended model for tier
 */
export function getModelForTier(
  tier: ModelTier,
  preferences?: { provider?: 'openai' | 'anthropic' | 'local' }
): string {
  const models: Record<ModelTier, Record<string, string>> = {
    fast: {
      openai: 'gpt-4o-mini',
      anthropic: 'claude-3-haiku',
      local: 'llama3.1:8b',
    },
    balanced: {
      openai: 'gpt-4o',
      anthropic: 'claude-3-sonnet',
      local: 'llama3.1:70b',
    },
    powerful: {
      openai: 'gpt-4-turbo',
      anthropic: 'claude-3-opus',
      local: 'mixtral:8x22b',
    },
  };

  return models[tier][preferences?.provider || 'anthropic'];
}

/**
 * Smart route with adaptive thresholds based on success rate
 */
export function smartRoute(
  prompt: string,
  history?: Array<{ prompt: string; tier: ModelTier; success: boolean }>
): RouterResult {
  let config: RouterConfig = {};

  if (history && history.length > 0) {
    // Analyze success rates per tier for similar prompts
    const similarPrompts = history.filter(h =>
      h.prompt.toLowerCase().split(' ').some(word =>
        prompt.toLowerCase().includes(word)
      )
    );

    if (similarPrompts.length > 0) {
      const successByTier: Record<ModelTier, { success: number; total: number }> = {
        fast: { success: 0, total: 0 },
        balanced: { success: 0, total: 0 },
        powerful: { success: 0, total: 0 },
      };

      for (const h of similarPrompts) {
        successByTier[h.tier].total++;
        if (h.success) successByTier[h.tier].success++;
      }

      // Adjust thresholds based on success rates
      const fastSuccess = successByTier.fast.total > 0
        ? successByTier.fast.success / successByTier.fast.total
        : 0.5;

      if (fastSuccess < 0.7) {
        config.thresholds = { fastToBalanced: 0.3, balancedToPowerful: 0.6 };
      }
    }
  }

  return route(prompt, config);
}
