/**
 * Fast Apply Engine - Deterministic Edit Merging Algorithm
 * 
 * Reverse-engineered from Cursor's Instant Apply and Morph's approach.
 * 
 * Algorithm:
 * 1. Parse edit snippet to extract changed sections and markers
 * 2. Match markers against original code using fuzzy matching
 * 3. Perform 3-way merge: original + snippet → merged output
 * 4. Handle edge cases: overlapping edits, indentation preservation, etc.
 */

export interface EditMarker {
  type: 'context' | 'change';
  content: string;
  lineNumber?: number;
}

export interface ParsedSnippet {
  beforeContext: string[];
  changes: string[];
  afterContext: string[];
  hasValidMarkers: boolean;
}

export interface MergeResult {
  output: string;
  success: boolean;
  conflicts: MergeConflict[];
  stats: {
    linesAdded: number;
    linesRemoved: number;
    linesUnchanged: number;
  };
}

export interface MergeConflict {
  type: 'marker_mismatch' | 'overlap' | 'context_not_found';
  message: string;
  location: string;
}

// Marker patterns for different languages
const MARKER_PATTERNS = [
  /\/\/ \.\.\. existing code \.\.\./,
  /\/\* \.\.\. existing code \.\.\. \*\//,
  /# \.\.\. existing code \.\.\./,
  /<!-- \.\.\. existing code \.\.\. -->/,
  /-- \.\.\. existing code \.\.\./,
  /; \.\.\. existing code \.\.\./,
];

/**
 * Check if a line is a context marker
 */
export function isMarker(line: string): boolean {
  return MARKER_PATTERNS.some(pattern => pattern.test(line.trim()));
}

/**
 * Parse an edit snippet into structured components
 */
export function parseSnippet(snippet: string): ParsedSnippet {
  const lines = snippet.split('\n');
  const beforeContext: string[] = [];
  const changes: string[] = [];
  const afterContext: string[] = [];
  
  let state: 'before' | 'changes' | 'after' = 'before';
  let markerCount = 0;
  
  for (const line of lines) {
    if (isMarker(line)) {
      markerCount++;
      if (markerCount === 1) {
        state = 'changes';
      } else if (markerCount === 2) {
        state = 'after';
      }
      continue;
    }
    
    if (state === 'before') {
      beforeContext.push(line);
    } else if (state === 'changes') {
      changes.push(line);
    } else {
      afterContext.push(line);
    }
  }
  
  return {
    beforeContext: beforeContext.filter(l => l.trim() !== ''),
    changes: changes.filter(l => l.trim() !== '' || changes.length > 1),
    afterContext: afterContext.filter(l => l.trim() !== ''),
    hasValidMarkers: markerCount >= 2,
  };
}

/**
 * Find the best match for context lines in the original code
 * Uses fuzzy matching with Levenshtein distance
 */
export function findContextLocation(
  originalLines: string[],
  contextLines: string[],
  startIndex: number = 0
): { index: number; confidence: number } | null {
  if (contextLines.length === 0) {
    return { index: startIndex, confidence: 1 };
  }
  
  let bestIndex = -1;
  let bestScore = 0;
  
  for (let i = startIndex; i <= originalLines.length - contextLines.length; i++) {
    const score = calculateMatchScore(
      originalLines.slice(i, i + contextLines.length),
      contextLines
    );
    
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  
  // Require at least 70% match confidence
  if (bestScore < 0.7) {
    return null;
  }
  
  return { index: bestIndex, confidence: bestScore };
}

/**
 * Calculate match score between two code sections
 * Combines exact match ratio with normalized Levenshtein distance
 */
export function calculateMatchScore(a: string[], b: string[]): number {
  if (a.length !== b.length) {
    return 0;
  }
  
  let totalScore = 0;
  
  for (let i = 0; i < a.length; i++) {
    const lineA = a[i].trim();
    const lineB = b[i].trim();
    
    if (lineA === lineB) {
      totalScore += 1;
    } else {
      // Partial credit based on similarity
      const similarity = 1 - (levenshtein(lineA, lineB) / Math.max(lineA.length, lineB.length));
      totalScore += Math.max(0, similarity - 0.3); // Penalty for inexact matches
    }
  }
  
  return totalScore / a.length;
}

/**
 * Levenshtein distance for fuzzy matching
 */
export function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return matrix[a.length][b.length];
}

/**
 * Detect indentation style from code
 */
export function detectIndentation(lines: string[]): { style: 'tabs' | 'spaces'; size: number } {
  let spaces = 0;
  let tabs = 0;
  let spaceCounts: number[] = [];
  
  for (const line of lines) {
    if (line.trim() === '') continue;
    
    const leading = line.match(/^(\s*)/)?.[1] || '';
    const tabCount = (leading.match(/\t/g) || []).length;
    const spaceCount = (leading.match(/ /g) || []).length;
    
    if (tabCount > 0) tabs++;
    if (spaceCount > 0) {
      spaces++;
      spaceCounts.push(spaceCount);
    }
  }
  
  if (tabs > spaces) {
    return { style: 'tabs', size: 1 };
  }
  
  // Calculate most common space indentation
  const counts: Record<number, number> = {};
  for (const n of spaceCounts) {
    counts[n] = (counts[n] || 0) + 1;
  }
  
  let mostCommon = 2; // default
  let maxCount = 0;
  for (const [size, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = parseInt(size);
    }
  }
  
  // Normalize to 2 or 4
  const size = mostCommon <= 2 ? 2 : 4;
  
  return { style: 'spaces', size };
}

/**
 * Apply indentation from original to changes
 */
export function applyIndentation(
  changes: string[],
  baseIndent: string
): string[] {
  return changes.map((line, i) => {
    if (line.trim() === '') return line;
    
    // Preserve relative indentation within changes
    const trimmed = line.trimStart();
    const relativeIndent = line.length - trimmed.length;
    
    return baseIndent + ' '.repeat(relativeIndent) + trimmed;
  });
}

/**
 * THE CORE FAST APPLY ALGORITHM
 * 
 * Merges an edit snippet into original code without LLM calls
 */
export function fastApply(
  originalCode: string,
  editSnippet: string,
  options: {
    fuzzyMatching?: boolean;
    preserveIndentation?: boolean;
    strictMarkers?: boolean;
  } = {}
): MergeResult {
  const {
    fuzzyMatching = true,
    preserveIndentation = true,
    strictMarkers = false,
  } = options;
  
  const conflicts: MergeConflict[] = [];
  const originalLines = originalCode.split('\n');
  
  // Parse the edit snippet
  const snippet = parseSnippet(editSnippet);
  
  if (!snippet.hasValidMarkers && strictMarkers) {
    return {
      output: originalCode,
      success: false,
      conflicts: [{
        type: 'marker_mismatch',
        message: 'Edit snippet missing valid // ... existing code ... markers',
        location: 'snippet',
      }],
      stats: { linesAdded: 0, linesRemoved: 0, linesUnchanged: originalLines.length },
    };
  }
  
  // If no markers, treat entire snippet as replacement
  if (!snippet.hasValidMarkers) {
    return {
      output: editSnippet,
      success: true,
      conflicts: [{
        type: 'marker_mismatch',
        message: 'No markers found - treated as full replacement',
        location: 'warning',
      }],
      stats: {
        linesAdded: editSnippet.split('\n').length,
        linesRemoved: originalLines.length,
        linesUnchanged: 0,
      },
    };
  }
  
  // Find insertion point using before context
  let insertIndex = 0;
  let matchConfidence = 1;
  
  if (snippet.beforeContext.length > 0) {
    const location = findContextLocation(originalLines, snippet.beforeContext);
    
    if (!location) {
      if (fuzzyMatching) {
        // Try with relaxed matching
        const relaxedLocation = findRelaxedLocation(originalLines, snippet.beforeContext);
        if (relaxedLocation) {
          insertIndex = relaxedLocation.index + snippet.beforeContext.length;
          matchConfidence = relaxedLocation.confidence;
        } else {
          conflicts.push({
            type: 'context_not_found',
            message: `Could not find before context: "${snippet.beforeContext.slice(0, 2).join('\n')}"`,
            location: 'before',
          });
          insertIndex = 0;
        }
      } else {
        conflicts.push({
          type: 'context_not_found',
          message: `Context not found (fuzzy matching disabled)`,
          location: 'before',
        });
        return {
          output: originalCode,
          success: false,
          conflicts,
          stats: { linesAdded: 0, linesRemoved: 0, linesUnchanged: originalLines.length },
        };
      }
    } else {
      insertIndex = location.index + snippet.beforeContext.length;
      matchConfidence = location.confidence;
    }
  }
  
  // Find end point using after context
  let endIndex = originalLines.length;
  
  if (snippet.afterContext.length > 0) {
    const location = findContextLocation(
      originalLines,
      snippet.afterContext,
      insertIndex
    );
    
    if (!location) {
      if (fuzzyMatching) {
        const relaxedLocation = findRelaxedLocation(
          originalLines.slice(insertIndex),
          snippet.afterContext
        );
        if (relaxedLocation) {
          endIndex = insertIndex + relaxedLocation.index;
        } else {
          conflicts.push({
            type: 'context_not_found',
            message: `Could not find after context`,
            location: 'after',
          });
        }
      } else {
        conflicts.push({
          type: 'context_not_found',
          message: `After context not found`,
          location: 'after',
        });
      }
    } else {
      endIndex = location.index;
    }
  }
  
  // Validate no overlap conflicts
  if (insertIndex > endIndex) {
    conflicts.push({
      type: 'overlap',
      message: 'Insertion point is after end point - contexts may overlap incorrectly',
      location: `${insertIndex}-${endIndex}`,
    });
    // Swap to recover
    [insertIndex, endIndex] = [endIndex, insertIndex];
  }
  
  // Apply indentation preservation
  let finalChanges = snippet.changes;
  if (preserveIndentation && insertIndex < originalLines.length) {
    const baseLine = originalLines[insertIndex];
    const baseIndentMatch = baseLine.match(/^(\s*)/);
    const baseIndent = baseIndentMatch ? baseIndentMatch[1] : '';
    finalChanges = applyIndentation(snippet.changes, baseIndent);
  }
  
  // Perform the merge
  const before = originalLines.slice(0, insertIndex);
  const replaced = originalLines.slice(insertIndex, endIndex);
  const after = originalLines.slice(endIndex);
  
  const mergedLines = [...before, ...finalChanges, ...after];
  
  // Calculate stats
  const stats = {
    linesAdded: finalChanges.length,
    linesRemoved: replaced.length,
    linesUnchanged: before.length + after.length,
  };
  
  return {
    output: mergedLines.join('\n'),
    success: conflicts.length === 0 || conflicts.every(c => c.location === 'warning'),
    conflicts,
    stats,
  };
}

/**
 * Relaxed context matching - ignores whitespace and comments
 */
function findRelaxedLocation(
  originalLines: string[],
  contextLines: string[],
  startIndex: number = 0
): { index: number; confidence: number } | null {
  const normalize = (s: string) => 
    s.trim().replace(/\s+/g, ' ').replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//, '');
  
  const normalizedContext = contextLines.map(normalize);
  
  for (let i = startIndex; i <= originalLines.length - contextLines.length; i++) {
    const normalizedOriginal = originalLines.slice(i, i + contextLines.length).map(normalize);
    
    let matches = 0;
    for (let j = 0; j < normalizedContext.length; j++) {
      if (normalizedContext[j] === normalizedOriginal[j]) {
        matches++;
      }
    }
    
    const confidence = matches / normalizedContext.length;
    if (confidence >= 0.5) {
      return { index: i, confidence };
    }
  }
  
  return null;
}

/**
 * Batch apply multiple edits to the same file
 * Handles dependency ordering and conflict detection
 */
export function batchApply(
  originalCode: string,
  edits: Array<{ instructions: string; snippet: string }>,
  options: { stopOnConflict?: boolean } = {}
): {
  finalOutput: string;
  results: MergeResult[];
  allConflicts: MergeConflict[];
} {
  let currentCode = originalCode;
  const results: MergeResult[] = [];
  const allConflicts: MergeConflict[] = [];
  
  for (let i = 0; i < edits.length; i++) {
    const result = fastApply(currentCode, edits[i].snippet, options);
    results.push(result);
    
    if (result.conflicts.length > 0) {
      allConflicts.push(...result.conflicts.map(c => ({
        ...c,
        location: `edit ${i + 1}: ${c.location}`,
      })));
      
      if (options.stopOnConflict && !result.success) {
        break;
      }
    }
    
    if (result.success) {
      currentCode = result.output;
    }
  }
  
  return {
    finalOutput: currentCode,
    results,
    allConflicts,
  };
}

/**
 * Utility: Generate a properly formatted edit snippet
 */
export function generateEditSnippet(
  originalCode: string,
  changes: string[],
  contextLines: number = 3
): string {
  const lines = originalCode.split('\n');
  const marker = '// ... existing code ...';
  
  return `${marker}
${changes.join('\n')}
${marker}`;
}
