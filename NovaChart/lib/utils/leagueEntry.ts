import { LeagueEntry } from '@/types';

/**
 * Extract LeagueEntry from raw API response
 * Safely extracts only LeagueEntry fields with default values
 * 
 * @param rawEntry - Raw entry object from API response (may contain extra fields)
 * @returns LeagueEntry object with all required fields
 */
export function extractLeagueEntry(rawEntry: any): LeagueEntry {
  if (!rawEntry) {
    throw new Error('Raw entry is required');
  }

  return {
    leagueId: rawEntry.leagueId || '',
    queueType: rawEntry.queueType || '',
    tier: rawEntry.tier || '',
    rank: rawEntry.rank || '',
    leaguePoints: rawEntry.leaguePoints || 0,
    wins: rawEntry.wins || 0,
    losses: rawEntry.losses || 0,
    veteran: rawEntry.veteran || false,
    inactive: rawEntry.inactive || false,
    freshBlood: rawEntry.freshBlood || false,
    hotStreak: rawEntry.hotStreak || false,
  };
}

