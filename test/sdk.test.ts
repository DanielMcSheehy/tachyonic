import { describe, it, expect } from 'vitest';
import { AIEditSDK, FastApplyClient, CompactClient, RouterClient } from '../src/index';

describe('AIEditSDK', () => {
  let sdk: AIEditSDK;

  beforeEach(() => {
    sdk = new AIEditSDK();
  });

  describe('Fast Apply Engine', () => {
    it('should merge edit snippets successfully', async () => {
      const result = await sdk.fastApply.applyDirect(
        'const x = 1;\nconst z = 3;',
        'Add y between x and z',
        '// ... existing code ...\nconst y = 2;\n// ... existing code ...'
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('const y = 2');
    });

    it('should validate edit snippets have markers', () => {
      expect(FastApplyClient.hasValidMarkers('// ... existing code ...\nconst x = 1;')).toBe(true);
      expect(FastApplyClient.hasValidMarkers('const x = 1;')).toBe(false);
    });

    it('should add markers when missing', () => {
      const result = FastApplyClient.addMarkers('const x = 1;', 'typescript');
      expect(result).toContain('// ... existing code ...');
    });

    it('should preserve indentation', async () => {
      const original = 'function test() {\n    return 1;\n  }';
      const edit = '// ... existing code ...\n    const x = 2;\n// ... existing code ...';
      
      const result = await sdk.fastApply.applyDirect(original, 'Add x', edit);
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('    const x = 2');
    });
  });

  describe('Compact Engine', () => {
    it('should compress text based on query relevance', async () => {
      const text = `Line 1: User asked about JWT
Line 2: Some unrelated discussion
Line 3: JWT tokens explained
Line 4: More unrelated stuff
Line 5: JWT implementation details`;

      const result = await sdk.compact.compact({
        input: text,
        query: 'JWT',
        compressionRatio: 0.6,
      });

      expect(result.output).toContain('JWT');
      expect(result.usage.compressionRatio).toBeGreaterThan(0);
    });

    it('should handle keepContext tags', () => {
      const wrapped = CompactClient.wrapKeepContext('critical code');
      expect(wrapped).toContain('<keepContext>');
      
      const unwrapped = CompactClient.unwrapKeepContext(wrapped);
      expect(unwrapped).not.toContain('<keepContext>');
    });
  });

  describe('Router Engine', () => {
    it('should route simple prompts to fast tier', async () => {
      const result = await sdk.router.route({ prompt: 'Say hello' });
      
      expect(result.tier).toBe('fast');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should route complex prompts to powerful tier', async () => {
      const result = await sdk.router.route({ prompt: 'Debug distributed system memory leak' });
      
      expect(result.tier).toBe('powerful');
    });

    it('should respect forced tier', async () => {
      const result = await sdk.router.route({ 
        prompt: 'Simple task', 
        tier: 'powerful' 
      });
      
      expect(result.tier).toBe('powerful');
      expect(result.confidence).toBe(1.0);
    });
  });

  describe('Integration', () => {
    it('should have all clients initialized', () => {
      expect(sdk.fastApply).toBeInstanceOf(FastApplyClient);
      expect(sdk.compact).toBeInstanceOf(CompactClient);
      expect(sdk.router).toBeInstanceOf(RouterClient);
    });

    it('should expose convenience methods', async () => {
      const mockApply = vi.spyOn(sdk.fastApply, 'execute').mockResolvedValue({
        output: 'success',
        success: true,
        usage: { inputTokens: 10, outputTokens: 10, processingTimeMs: 100 },
      });

      const result = await sdk.editFile('test.ts', 'test', 'test');
      
      expect(result.success).toBe(true);
      expect(mockApply).toHaveBeenCalled();
    });
  });
});
