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
    // defaults when not provided
    expect(entry.leagueId).toBe('');
    expect(entry.veteran).toBe(false);
  });

  it('extracts leagueId when provided', () => {
    const entry = extractLeagueEntry({
      leagueId: 'league-id-123',
      queueType: 'RANKED_SOLO_5x5',
      tier: 'GOLD',
      rank: 'IV',
      leaguePoints: 0,
      wins: 0,
      losses: 0,
    });
    expect(entry.leagueId).toBe('league-id-123');
  });

  it('uses default empty string for missing optional fields', () => {
    const entry = extractLeagueEntry({
      queueType: 'RANKED_SOLO_5x5',
      tier: 'SILVER',
      rank: 'I',
      leaguePoints: 75,
      wins: 5,
      losses: 3,
    });
    expect(entry.leagueId).toBe('');
    expect(entry.veteran).toBe(false);
    expect(entry.inactive).toBe(false);
    expect(entry.freshBlood).toBe(false);
    expect(entry.hotStreak).toBe(false);
  });

  it('throws when rawEntry is null', () => {
    expect(() => extractLeagueEntry(null as any)).toThrow('Raw entry is required');
  });

  it('throws when rawEntry is undefined', () => {
    expect(() => extractLeagueEntry(undefined as any)).toThrow();
  });
});

