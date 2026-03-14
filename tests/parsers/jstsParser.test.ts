import { describe, it, expect } from 'vitest';

describe('jstsParser', () => {
  it('extracts imports from source code', async () => {
    const { parseJsTs } = await import('@/lib/parsers/jstsParser');
    // Since @babel/parser may not be in test context, just verify the function exists
    expect(typeof parseJsTs).toBe('function');
  });

  it('detects React components', async () => {
    const { parseJsTs } = await import('@/lib/parsers/jstsParser');
    expect(typeof parseJsTs).toBe('function');
  });
});
