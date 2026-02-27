import { describe, it, expect } from 'vitest';
import { extractLeagueEntry } from '../lib/utils/leagueEntry';

describe('extractLeagueEntry', () => {
  it('extracts fields with defaults', () => {
    const entry = extractLeagueEntry({
      queueType: 'RANKED_SOLO_5x5',
      tier: 'GOLD',
      rank: 'II',
      leaguePoints: 50,
      wins: 10,
      losses: 8,
    });

    expect(entry.queueType).toBe('RANKED_SOLO_5x5');
    expect(entry.tier).toBe('GOLD');
    expect(entry.rank).toBe('II');
    expect(entry.leaguePoints).toBe(50);
    expect(entry.wins).toBe(10);
    expect(entry.losses).toBe(8);
    // defaults
    expect(entry.leagueId).toBe('');
    expect(entry.veteran).toBe(false);
  });

  it('throws when rawEntry is null', () => {
    expect(() => extractLeagueEntry(null as any)).toThrow();
  });
});

