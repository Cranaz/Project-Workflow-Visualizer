import { describe, it, expect } from 'vitest';

describe('buildGraph', () => {
  it('exports buildGraph function', async () => {
    const mod = await import('@/lib/graph/buildGraph');
    expect(typeof mod.buildGraph).toBe('function');
  });
});
