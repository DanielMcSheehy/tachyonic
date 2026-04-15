/**
 * Morph Reverse-Engineered Core Engines
 * 
 * Self-contained implementations of Morph's core algorithms:
 * - FastApply: Deterministic edit merging (no LLM required)
 * - Compact: TF-IDF based context compression (no LLM required)
 * - Router: Heuristic prompt classification (no LLM required)
 * 
 * Pure local implementations - no external API calls required.
 */

export {
  fastApply,
  parseSnippet,
  isMarker,
  findContextLocation,
  calculateMatchScore,
  levenshtein,
  detectIndentation,
  applyIndentation,
  batchApply,
  generateEditSnippet,
  type EditMarker,
  type ParsedSnippet,
  type MergeResult,
  type MergeConflict,
} from './fast-apply-engine';

export {
  compact,
  compactMessages,
  compactCode,
  smartCompact,
  type CompressionConfig,
  type LineScore,
  type CompressionResult,
} from './compact-engine';

export {
  route,
  batchRoute,
  getModelForTier,
  smartRoute,
  type ModelTier,
  type RouterConfig,
  type RouterResult,
  type PromptFeatures,
} from './router-engine';
