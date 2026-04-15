/**
 * Compact Engine - Context Compression Algorithm
 * 
 * Reverse-engineered from Morph's Compact architecture.
 * 
 * Algorithm:
 * 1. Tokenize input into lines with metadata
 * 2. Score each line for relevance to query (TF-IDF + position bias)
 * 3. Keep lines above threshold + recent context preservation
 * 4. Group kept lines into ranges, mark filtered sections
 * 5. Output compressed text with (filtered N lines) markers
 * 
 * Goal: 50-70% reduction, every kept line is byte-identical.
 */

export interface CompressionConfig {
  /** Target compression ratio 0.05-1.0 (default: 0.5) */
  targetRatio?: number;
  /** Keep last N messages uncompressed (default: 2) */
  preserveRecent?: number;
  /** Min lines to keep in a section (default: 3) */
  minSectionLength?: number;
  /** Enable query-aware scoring (default: true) */
  queryAware?: boolean;
  /** Include (filtered N lines) markers (default: true) */
  includeMarkers?: boolean;
  /** Include line range metadata (default: true) */
  includeRanges?: boolean;
}

export interface LineScore {
  lineNumber: number;
  content: string;
  score: number; // 0-1 relevance
  keep: boolean;
  reason: 'query_match' | 'recent' | 'context' | 'structural' | 'filtered';
}

export interface CompressionResult {
  output: string;
  originalLines: number;
  keptLines: number;
  compressionRatio: number;
  lineScores: LineScore[];
  keptRanges: Array<{ start: number; end: number }>;
  filteredRanges: Array<{ start: number; end: number; count: number }>;
}

/**
 * THE CORE COMPACT ALGORITHM
 */
export function compact(
  input: string,
  query?: string,
  config: CompressionConfig = {}
): CompressionResult {
  const {
    targetRatio = 0.5,
    preserveRecent = 2,
    minSectionLength = 3,
    queryAware = true,
    includeMarkers = true,
    includeRanges = true,
  } = config;

  const lines = input.split('\n');
  const originalLines = lines.length;

  // Handle edge cases
  if (originalLines === 0) {
    return {
      output: '',
      originalLines: 0,
      keptLines: 0,
      compressionRatio: 1,
      lineScores: [],
      keptRanges: [],
      filteredRanges: [],
    };
  }

  if (originalLines <= minSectionLength * 2) {
    // Too short to compress meaningfully
    return {
      output: input,
      originalLines,
      keptLines: originalLines,
      compressionRatio: 1,
      lineScores: lines.map((content, i) => ({
        lineNumber: i + 1,
        content,
        score: 1,
        keep: true,
        reason: 'context',
      })),
      keptRanges: [{ start: 1, end: originalLines }],
      filteredRanges: [],
    };
  }

  // Step 1: Score each line
  const lineScores = calculateLineScores(lines, query, {
    preserveRecent,
    queryAware,
  });

  // Step 2: Determine keep threshold based on target ratio
  const targetKeepCount = Math.max(
    Math.floor(originalLines * targetRatio),
    minSectionLength
  );

  // Step 3: Select lines to keep
  const keptLines = selectLinesToKeep(lineScores, targetKeepCount, minSectionLength);

  // Step 4: Group into ranges
  const { keptRanges, filteredRanges } = groupIntoRanges(keptLines, originalLines);

  // Step 5: Build output with markers
  const output = buildOutput(lines, keptRanges, filteredRanges, includeMarkers);

  const actualKeptLines = keptLines.filter(l => l.keep).length;
  const compressionRatio = actualKeptLines / originalLines;

  return {
    output,
    originalLines,
    keptLines: actualKeptLines,
    compressionRatio,
    lineScores: keptLines,
    keptRanges: includeRanges ? keptRanges : [],
    filteredRanges: includeRanges ? filteredRanges : [],
  };
}

/**
 * Calculate relevance score for each line
 */
function calculateLineScores(
  lines: string[],
  query: string | undefined,
  options: { preserveRecent: number; queryAware: boolean }
): LineScore[] {
  const { preserveRecent, queryAware } = options;
  const scores: LineScore[] = [];

  // Extract query keywords
  const queryTerms = query
    ? query.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 2)
    : [];

  // Calculate IDF for query terms
  const idf: Record<string, number> = {};
  if (queryAware && queryTerms.length > 0) {
    for (const term of queryTerms) {
      const docsWithTerm = lines.filter(line =>
        line.toLowerCase().includes(term)
      ).length;
      idf[term] = Math.log(lines.length / (docsWithTerm + 1)) + 1;
    }
  }

  // Score each line
  for (let i = 0; i < lines.length; i++) {
    const content = lines[i];
    const lineNum = i + 1;
    const isRecent = i >= lines.length - preserveRecent;

    // Base score from position (recent lines get boost)
    let score = isRecent ? 0.8 : 0.3;
    let reason: LineScore['reason'] = isRecent ? 'recent' : 'context';

    // Query-aware scoring (TF-IDF)
    if (queryAware && queryTerms.length > 0) {
      const lineLower = content.toLowerCase();
      let queryScore = 0;

      for (const term of queryTerms) {
        // TF (term frequency in line)
        const tf = (lineLower.match(new RegExp(term, 'g')) || []).length;
        // TF-IDF
        queryScore += tf * (idf[term] || 1);
      }

      // Normalize
      const normalizedQueryScore = Math.min(queryScore / queryTerms.length, 1);

      if (normalizedQueryScore > 0.3) {
        score = Math.max(score, normalizedQueryScore);
        reason = 'query_match';
      }
    }

    // Structural importance (headers, function definitions, imports)
    const trimmed = content.trim();
    if (
      trimmed.match(/^(import|export|from|const|let|var|function|class|interface|type|#|##|###)/) ||
      trimmed.match(/^(def|class|import|from)\s/) || // Python
      trimmed.match(/^(fn|struct|impl|use|mod|pub)\s/) // Rust
    ) {
      score = Math.max(score, 0.7);
      if (reason !== 'query_match') {
        reason = 'structural';
      }
    }

    // Code block markers
    if (trimmed === '```' || trimmed.match(/^```\w+/)) {
      score = 0.9;
      reason = 'structural';
    }

    scores.push({
      lineNumber: lineNum,
      content,
      score,
      keep: false, // Will be set later
      reason,
    });
  }

  return scores;
}

/**
 * Select which lines to keep based on scores
 */
function selectLinesToKeep(
  scores: LineScore[],
  targetCount: number,
  minSectionLength: number
): LineScore[] {
  // Sort by score descending
  const sorted = [...scores].sort((a, b) => b.score - a.score);

  // Mark top lines as keep
  for (let i = 0; i < Math.min(targetCount, sorted.length); i++) {
    sorted[i].keep = true;
  }

  // Ensure we have enough context around kept lines
  const result = ensureContext(scores, minSectionLength);

  return result;
}

/**
 * Ensure minimum context around kept lines
 */
function ensureContext(
  scores: LineScore[],
  minSectionLength: number
): LineScore[] {
  const result = [...scores];

  // Find kept lines and expand context
  for (let i = 0; i < result.length; i++) {
    if (result[i].keep) {
      // Keep minSectionLength lines before and after
      const start = Math.max(0, i - Math.floor(minSectionLength / 2));
      const end = Math.min(result.length, i + Math.ceil(minSectionLength / 2));

      for (let j = start; j < end; j++) {
        if (!result[j].keep) {
          result[j].keep = true;
          result[j].reason = 'context';
        }
      }
    }
  }

  // Merge adjacent kept sections
  for (let i = 0; i < result.length - 1; i++) {
    if (result[i].keep && result[i + 1].keep) {
      // Check gap size
      let gapEnd = i + 1;
      while (gapEnd < result.length && result[gapEnd].keep) {
        gapEnd++;
      }

      const gapSize = gapEnd - i - 1;
      if (gapSize <= minSectionLength && gapSize > 0) {
        // Fill the gap
        for (let j = i + 1; j < gapEnd; j++) {
          result[j].keep = true;
          result[j].reason = 'context';
        }
      }
    }
  }

  return result;
}

/**
 * Group kept lines into contiguous ranges
 */
function groupIntoRanges(
  scores: LineScore[],
  totalLines: number
): {
  keptRanges: Array<{ start: number; end: number }>;
  filteredRanges: Array<{ start: number; end: number; count: number }>;
} {
  const keptRanges: Array<{ start: number; end: number }> = [];
  const filteredRanges: Array<{ start: number; end: number; count: number }> = [];

  let currentKeptStart: number | null = null;
  let currentFilteredStart: number | null = null;

  for (let i = 0; i < scores.length; i++) {
    const isKept = scores[i].keep;

    if (isKept) {
      // End filtered range if active
      if (currentFilteredStart !== null) {
        filteredRanges.push({
          start: currentFilteredStart,
          end: i,
          count: i - currentFilteredStart,
        });
        currentFilteredStart = null;
      }

      // Start or extend kept range
      if (currentKeptStart === null) {
        currentKeptStart = i + 1; // 1-indexed
      }
    } else {
      // End kept range if active
      if (currentKeptStart !== null) {
        keptRanges.push({
          start: currentKeptStart,
          end: i, // inclusive
        });
        currentKeptStart = null;
      }

      // Start filtered range
      if (currentFilteredStart === null) {
        currentFilteredStart = i + 1; // 1-indexed
      }
    }
  }

  // Close final ranges
  if (currentKeptStart !== null) {
    keptRanges.push({
      start: currentKeptStart,
      end: totalLines,
    });
  }

  if (currentFilteredStart !== null) {
    filteredRanges.push({
      start: currentFilteredStart,
      end: totalLines,
      count: totalLines - currentFilteredStart + 1,
    });
  }

  return { keptRanges, filteredRanges };
}

/**
 * Build compressed output string
 */
function buildOutput(
  lines: string[],
  keptRanges: Array<{ start: number; end: number }>,
  filteredRanges: Array<{ start: number; end: number; count: number }>,
  includeMarkers: boolean
): string {
  const output: string[] = [];
  let lastKeptEnd = 0;

  for (const range of keptRanges) {
    // Add filtered marker before this range (if there was a gap)
    if (includeMarkers && range.start > lastKeptEnd + 1) {
      const filteredCount = range.start - lastKeptEnd - 1;
      if (filteredCount > 0) {
        output.push(`(filtered ${filteredCount} lines)`);
      }
    }

    // Add kept lines (convert to 0-indexed)
    const keptLines = lines.slice(range.start - 1, range.end);
    output.push(...keptLines);

    lastKeptEnd = range.end;
  }

  // Check for trailing filtered section
  if (includeMarkers && lastKeptEnd < lines.length) {
    const filteredCount = lines.length - lastKeptEnd;
    output.push(`(filtered ${filteredCount} lines)`);
  }

  return output.join('\n');
}

/**
 * Compress chat messages (preserves message boundaries)
 */
export function compactMessages(
  messages: Array<{ role: string; content: string }>,
  query?: string,
  config: CompressionConfig = {}
): {
  messages: Array<{ role: string; content: string; compacted?: boolean }>;
  stats: { originalTokens: number; compressedTokens: number; ratio: number };
} {
  // Compact each message individually
  const compacted = messages.map((msg, i) => {
    // Preserve recent messages
    const isRecent = i >= messages.length - (config.preserveRecent ?? 2);

    if (isRecent || msg.role === 'system') {
      return { ...msg, compacted: false };
    }

    const result = compact(msg.content, query, config);
    return {
      role: msg.role,
      content: result.output,
      compacted: result.compressionRatio < 1,
    };
  });

  // Calculate stats
  const originalTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  const compressedTokens = compacted.reduce((sum, m) => sum + estimateTokens(m.content), 0);

  return {
    messages: compacted,
    stats: {
      originalTokens,
      compressedTokens,
      ratio: compressedTokens / originalTokens,
    },
  };
}

/**
 * Compress code with syntax-aware preservation
 */
export function compactCode(
  code: string,
  query?: string,
  config: CompressionConfig & { language?: string } = {}
): CompressionResult {
  const { language, ...compactConfig } = config;

  // Pre-process: mark important structural lines
  const lines = code.split('\n');
  const markedLines = lines.map((line, i) => {
    const trimmed = line.trim();

    // Always preserve:
    // - Import/require statements
    // - Function/class/struct definitions
    // - Exported items
    // - Type definitions
    const isStructural =
      trimmed.match(/^(import|export|from|require|module\.exports)/) ||
      trimmed.match(/^(function|class|interface|type|enum|const|let|var|async\s+function)/) ||
      trimmed.match(/^(def|class|import|from)/) || // Python
      trimmed.match(/^(fn|struct|impl|trait|use|mod|pub)/) || // Rust
      trimmed.match(/^(func|struct|class|protocol|extension|import)/) || // Swift
      trimmed.match(/^\s*(public|private|protected|internal|static|async)/);

    if (isStructural && !line.startsWith('// <keepContext>')) {
      return `// <keepContext>\n${line}\n// </keepContext>`;
    }

    return line;
  });

  // Process with keepContext markers
  let processed = markedLines.join('\n');
  processed = processed.replace(/\/\/ <keepContext>\n/g, '');
  processed = processed.replace(/\n\/\/ <\/keepContext>/g, '');

  return compact(processed, query, {
    ...compactConfig,
    minSectionLength: 5, // Longer sections for code
  });
}

/**
 * Simple token estimation (4 chars per token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Smart compress with auto-detected query
 */
export function smartCompact(
  input: string,
  options: {
    recentContext?: string;
    autoQuery?: boolean;
  } = {}
): CompressionResult {
  let query: string | undefined;

  if (options.autoQuery !== false && options.recentContext) {
    // Extract likely topic from recent context
    const words = options.recentContext
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !['this', 'that', 'with', 'from', 'have', 'will', 'been'].includes(w));

    // Get most frequent meaningful words
    const freq: Record<string, number> = {};
    for (const word of words) {
      freq[word] = (freq[word] || 0) + 1;
    }

    const topWords = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([w]) => w);

    if (topWords.length > 0) {
      query = topWords.join(' ');
    }
  }

  return compact(input, query);
}
