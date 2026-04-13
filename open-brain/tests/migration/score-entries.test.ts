import { describe, it, expect } from 'vitest';
import { scoreEntry, triageEntries } from '../../src/migration/score-entries.js';
import type { EntryForScoring } from '../../src/migration/score-entries.js';

const base: EntryForScoring = {
  helpful: 0,
  harmful: 0,
  neutral: 0,
  recall_count: 0,
  tags: '',
  content: '',
  maturity: 'progenitor',
};

describe('scoreEntry', () => {
  it('scores a high-value entry at 9', () => {
    const entry: EntryForScoring = {
      helpful: 5,
      harmful: 0,
      neutral: 1,
      recall_count: 3,
      tags: 'typescript,migration',
      content: 'A'.repeat(101),
      maturity: 'mature',
    };
    expect(scoreEntry(entry)).toBe(9);
  });

  it('scores a zero-value entry at 0', () => {
    expect(scoreEntry(base)).toBe(0);
  });

  it('scores a partial entry with just tags at 1', () => {
    const entry: EntryForScoring = { ...base, tags: 'some-tag' };
    expect(scoreEntry(entry)).toBe(1);
  });

  it('awards +2 for helpful > 0', () => {
    const entry: EntryForScoring = { ...base, helpful: 1 };
    expect(scoreEntry(entry)).toBe(2);
  });

  it('awards +2 for recall_count > 0', () => {
    const entry: EntryForScoring = { ...base, recall_count: 1 };
    expect(scoreEntry(entry)).toBe(2);
  });

  it('awards +1 for content length > 100', () => {
    const entry: EntryForScoring = { ...base, content: 'B'.repeat(101) };
    expect(scoreEntry(entry)).toBe(1);
  });

  it('awards +3 for maturity proven', () => {
    const entry: EntryForScoring = { ...base, maturity: 'proven' };
    expect(scoreEntry(entry)).toBe(3);
  });

  it('awards +3 for maturity mature', () => {
    const entry: EntryForScoring = { ...base, maturity: 'mature' };
    expect(scoreEntry(entry)).toBe(3);
  });

  it('does not award maturity bonus for progenitor', () => {
    const entry: EntryForScoring = { ...base, maturity: 'progenitor' };
    expect(scoreEntry(entry)).toBe(0);
  });
});

describe('triageEntries', () => {
  it('separates entries into migrate/maybe/skip correctly', () => {
    const entries = [
      { id: 1, key: 'high', ...base, helpful: 5, recall_count: 3, tags: 'a', content: 'A'.repeat(101), maturity: 'mature' },
      { id: 2, key: 'mid', ...base, tags: 'only-tag' },
      { id: 3, key: 'low', ...base },
      { id: 4, key: 'mid2', ...base, recall_count: 1 },
    ];

    const result = triageEntries(entries);

    expect(result.migrate.map(e => e.key)).toContain('high');
    expect(result.maybe.map(e => e.key)).toContain('mid');
    expect(result.maybe.map(e => e.key)).toContain('mid2');
    expect(result.skip.map(e => e.key)).toContain('low');
  });

  it('attaches computed score to each entry', () => {
    const entries = [
      { id: 1, key: 'k', ...base, helpful: 1 },
    ];
    const result = triageEntries(entries);
    expect(result.maybe[0].score).toBe(2);
  });

  it('handles empty array', () => {
    const result = triageEntries([]);
    expect(result.migrate).toHaveLength(0);
    expect(result.maybe).toHaveLength(0);
    expect(result.skip).toHaveLength(0);
  });
});
