/**
 * Core types and interfaces for AI Edit SDK
 * Pure local implementations - no API dependencies
 */

// ============================================================================
// BASE CONFIGURATION
// ============================================================================

export interface SDKConfig {
  /** Optional timeout in ms (default: 120000) */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
}

export interface RetryConfig {
  /** Max retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in ms (default: 1000) */
  baseDelay?: number;
  /** Max delay in ms (default: 10000) */
  maxDelay?: number;
}

// ============================================================================
// MESSAGE TYPES (OpenAI-compatible)
// ============================================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// ============================================================================
// FAST APPLY TYPES
// ============================================================================

export interface FastApplyInput {
  /** Target file path */
  targetFilepath: string;
  /** Natural language instruction for the edit */
  instructions: string;
  /** Code edit snippet with // ... existing code ... markers */
  codeEdit: string;
  /** Original file content (optional - will be read if not provided) */
  originalCode?: string;
}

export interface FastApplyResult {
  /** Merged code output */
  output: string;
  /** Whether the merge succeeded */
  success: boolean;
  /** Processing metadata */
  usage: {
    inputTokens: number;
    outputTokens: number;
    processingTimeMs: number;
  };
}

// ============================================================================
// COMPACT TYPES
// ============================================================================

export interface CompactInput {
  /** Input text or message array */
  input: string | ChatMessage[];
  /** Alternative: messages array */
  messages?: ChatMessage[];
  /** Focus query for relevance-based pruning */
  query?: string;
  /** Fraction to keep 0.05-1.0 (default: 0.5) */
  compressionRatio?: number;
  /** Keep last N messages uncompressed (default: 2) */
  preserveRecent?: number;
  /** Compress system messages too (default: false) */
  compressSystemMessages?: boolean;
  /** Include compacted line ranges in response (default: true) */
  includeLineRanges?: boolean;
  /** Include (filtered N lines) markers (default: true) */
  includeMarkers?: boolean;
}

export interface LineRange {
  start: number;
  end: number;
}

export interface CompactMessage {
  role: string;
  content: string;
  compacted_line_ranges: LineRange[];
  kept_line_ranges: LineRange[];
}

export interface CompactResult {
  id: string;
  /** Compressed output text */
  output: string;
  /** Per-message compression details */
  messages: CompactMessage[];
  /** Usage statistics */
  usage: {
    inputTokens: number;
    outputTokens: number;
    compressionRatio: number;
    processingTimeMs: number;
  };
  model: string;
}

// ============================================================================
// ROUTER TYPES
// ============================================================================

export type ModelTier = 'fast' | 'balanced' | 'powerful';

export interface RouterInput {
  /** Prompt text to route */
  prompt: string;
  /** Optional conversation context */
  messages?: ChatMessage[];
  /** Force specific tier (optional) */
  tier?: ModelTier;
}

export interface RouterResult {
  /** Selected model ID */
  selectedModel: string;
  /** Selected tier */
  tier: ModelTier;
  /** Routing confidence (0-1) */
  confidence: number;
  /** Reasoning for selection */
  reasoning: string;
  /** Estimated cost */
  estimatedCost: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    processingTimeMs: number;
  };
}

// ============================================================================
// API RESPONSE TYPES (OpenAI-compatible)
// ============================================================================

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface EmbeddingResponse {
  object: 'list';
  data: Array<{
    object: 'embedding';
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class SDKError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'SDKError';
  }
}

export class SDKTimeoutError extends Error {
  constructor(message: string = 'Request timeout') {
    super(message);
    this.name = 'SDKTimeoutError';
  }
}

export class SDKAuthError extends Error {
  constructor(message: string = 'Invalid API key') {
    super(message);
    this.name = 'SDKAuthError';
  }
}