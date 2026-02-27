import Dexie, { Table } from 'dexie';
import { RateHistory, Goal, Match, Summoner, LeagueEntry, SkillGoal } from '@/types';

export class NovaChartDB extends Dexie {
  rateHistory!: Table<RateHistory, string>; // matchId as primary key (string)
  goals!: Table<Goal, number>;
  matches!: Table<Match, string>; // matchId as primary key (string)
  summoners!: Table<Summoner, string>;
  leagueEntries!: Table<LeagueEntry & { puuid: string; lastUpdated: Date }, string>; // leagueId as primary key
  skillGoals!: Table<SkillGoal, number>;

  constructor() {
    // Use a new database name to avoid primary key migration issues
    // This will create a fresh database with the correct schema
    // Changed to v6 to avoid version conflicts with existing databases (leagueEntries table now uses leagueId as primary key)
    super('NovaChartDB_v6');
    
    // Start directly with the correct schema (leagueId as primary key for leagueEntries)
    // This is a new database (v6), so we start with the final schema
    // If users have old data, they will need to re-add their summoners
    this.version(1).stores({
      rateHistory: '&matchId, date, tier, rank, lp', // matchId as primary key
      goals: '++id, targetDate, createdAt, isActive',
      matches: '&matchId, date, win, role, champion', // matchId as primary key
      summoners: '&puuid, id, name, region, lastUpdated', // puuid as primary key
      leagueEntries: '&leagueId, puuid, queueType, lastUpdated', // leagueId as primary key (Riot API spec), puuid as index
      skillGoals: '++id, type, lane, createdAt, isActive',
    });
  }
}

/** Legacy DB names to migrate from. Old DBs are NOT deleted and are kept. */
const LEGACY_DB_NAMES = ['NovaChartDB', 'NovaChartDB_v2', 'NovaChartDB_v3', 'NovaChartDB_v4', 'NovaChartDB_v5'];

const MIGRATION_DONE_KEY = 'NovaChartDB_migration_v6_done';

/** Normalize date field from IndexedDB (may be number or string) to Date. */
function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') return new Date(value);
  return new Date();
}

/**
 * Migrate data from one legacy DB into the current db (v6).
 * Does NOT delete the legacy DB.
 */
async function migrateFromLegacyDb(legacyDbName: string, targetDb: NovaChartDB): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(legacyDbName);
    let totalMigrated = 0;

    request.onerror = () => {
      // DB does not exist or cannot be opened - not an error for us
      resolve(0);
    };

    request.onsuccess = async () => {
      const legacyDb = request.result;
      const storeNames = Array.from(legacyDb.objectStoreNames) as string[];
      const supportedStores = ['rateHistory', 'goals', 'matches', 'summoners', 'leagueEntries', 'skillGoals'];

      try {
        for (const storeName of storeNames) {
          if (!supportedStores.includes(storeName)) continue;
          const tx = legacyDb.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const getAllRequest = store.getAll();

          const records = await new Promise<unknown[]>((res, rej) => {
            getAllRequest.onsuccess = () => res(getAllRequest.result ?? []);
            getAllRequest.onerror = () => rej(getAllRequest.error);
          });

          if (records.length === 0) continue;

          const normalized = records.map((r: Record<string, unknown>) => {
            const row = { ...r } as Record<string, unknown>;
            if ('date' in row && row.date != null) row.date = toDate(row.date);
            if ('createdAt' in row && row.createdAt != null) row.createdAt = toDate(row.createdAt);
            if ('lastUpdated' in row && row.lastUpdated != null) row.lastUpdated = toDate(row.lastUpdated);
            if ('targetDate' in row && row.targetDate != null) row.targetDate = toDate(row.targetDate);
            return row;
          });

          try {
            if (storeName === 'rateHistory') {
              const existing = await targetDb.rateHistory.toArray();
              const existingIds = new Set(existing.map((x) => x.matchId));
              const toAdd = normalized.filter((r) => r.matchId && !existingIds.has(r.matchId as string)) as RateHistory[];
              if (toAdd.length) await targetDb.rateHistory.bulkAdd(toAdd);
              totalMigrated += toAdd.length;
            } else if (storeName === 'matches') {
              const existing = await targetDb.matches.toArray();
              const existingIds = new Set(existing.map((x) => x.matchId));
              const toAdd = normalized.filter((r) => r.matchId && !existingIds.has(r.matchId as string)) as Match[];
              if (toAdd.length) await targetDb.matches.bulkAdd(toAdd);
              totalMigrated += toAdd.length;
            } else if (storeName === 'summoners') {
              const existing = await targetDb.summoners.toArray();
              const existingIds = new Set(existing.map((x) => x.puuid));
              const toAdd = normalized.filter((r) => r.puuid && !existingIds.has(r.puuid as string)) as Summoner[];
              if (toAdd.length) await targetDb.summoners.bulkAdd(toAdd);
              totalMigrated += toAdd.length;
            } else if (storeName === 'leagueEntries') {
              const existing = await targetDb.leagueEntries.toArray();
              const existingIds = new Set(existing.map((x) => x.leagueId));
              const toAdd = normalized.filter((r) => {
                const leagueId = (r.leagueId ?? r.puuid) as string;
                return leagueId && !existingIds.has(leagueId);
              }) as (LeagueEntry & { puuid: string; lastUpdated: Date })[];
              for (const r of toAdd) {
                if (!r.leagueId && r.puuid) (r as Record<string, unknown>).leagueId = `migrated-${r.puuid}`;
              }
              if (toAdd.length) await targetDb.leagueEntries.bulkPut(toAdd);
              totalMigrated += toAdd.length;
            } else if (storeName === 'goals') {
              const toAdd = normalized.map((r) => {
                const { id: _id, ...rest } = r as Goal & { id?: number };
                return rest as Omit<Goal, 'id'>;
              });
              if (toAdd.length) await targetDb.goals.bulkAdd(toAdd as Goal[]);
              totalMigrated += toAdd.length;
            } else if (storeName === 'skillGoals') {
              const toAdd = normalized.map((r) => {
                const { id: _id, ...rest } = r as SkillGoal & { id?: number };
                return rest as Omit<SkillGoal, 'id'>;
              });
              if (toAdd.length) await targetDb.skillGoals.bulkAdd(toAdd as SkillGoal[]);
              totalMigrated += toAdd.length;
            }
          } catch (e) {
            console.warn(`[NovaChartDB] Migration from ${legacyDbName} store ${storeName} failed:`, e);
          }
        }

        legacyDb.close();
        resolve(totalMigrated);
      } catch (e) {
        legacyDb.close();
        reject(e);
      }
    };
  });
}

/**
 * Run migration from all legacy DBs into v6 once.
 * Old DBs are left intact (not deleted).
 */
export async function runMigrationIfNeeded(): Promise<void> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;
  try {
    const done = localStorage.getItem(MIGRATION_DONE_KEY);
    if (done === 'true') return;

    let total = 0;
    for (const name of LEGACY_DB_NAMES) {
      const count = await migrateFromLegacyDb(name, db);
      if (count > 0) console.log(`[NovaChartDB] Migrated ${count} records from ${name}`);
      total += count;
    }

    localStorage.setItem(MIGRATION_DONE_KEY, 'true');
    if (total > 0) console.log(`[NovaChartDB] Migration done. Total records migrated: ${total}`);
  } catch (e) {
    console.warn('[NovaChartDB] Migration failed:', e);
  }
}

// Create database instance
export const db = new NovaChartDB();

// Helper functions for data operations
export const rateHistoryService = {
  async getAll(): Promise<RateHistory[]> {
    try {
      const result = await db.rateHistory.orderBy('date').toArray();
      // Filter out any entries without matchId (should not happen, but safety check)
      const valid = result.filter(r => r.matchId);
      return valid;
    } catch (error) {
      throw error;
    }
  },

  async getByDateRange(startDate: Date, endDate: Date): Promise<RateHistory[]> {
    return await db.rateHistory
      .where('date')
      .between(startDate, endDate, true, true)
      .sortBy('date');
  },

  async getByMatchId(matchId: string): Promise<RateHistory | undefined> {
    return await db.rateHistory.get(matchId);
  },

  async getAllMatchIds(): Promise<string[]> {
    const all = await db.rateHistory.toArray();
    return all.map(r => r.matchId);
  },

  async add(rate: RateHistory): Promise<string> {
    // Validate matchId
    if (!rate.matchId || typeof rate.matchId !== 'string') {
      throw new Error(`Invalid matchId: ${rate.matchId}`);
    }
    // Check for duplicate by matchId
    const existing = await db.rateHistory.get(rate.matchId);

    if (existing) {
      // Update existing entry instead of adding duplicate
      console.log('[RateHistoryService] Duplicate entry found for matchId:', rate.matchId, 'Updating existing entry');
      await db.rateHistory.update(rate.matchId, {
        date: rate.date,
        tier: rate.tier,
        rank: rate.rank,
        lp: rate.lp,
        wins: rate.wins,
        losses: rate.losses,
      });
      return rate.matchId;
    }

    return await db.rateHistory.add(rate);
  },

  async update(matchId: string, changes: Partial<Omit<RateHistory, 'matchId'>>): Promise<number> {
    return await db.rateHistory.update(matchId, changes);
  },

  async delete(matchId: string): Promise<void> {
    return await db.rateHistory.delete(matchId);
  },

  async deleteAll(): Promise<void> {
    return await db.rateHistory.clear();
  },

  async getLatest(): Promise<RateHistory | undefined> {
    return await db.rateHistory.orderBy('date').last();
  },
};

export const goalService = {
  async getAll(): Promise<Goal[]> {
    return await db.goals.orderBy('targetDate').toArray();
  },

  async getActive(): Promise<Goal | undefined> {
    return await db.goals.where('isActive').equals(1).first();
  },

  async add(goal: Omit<Goal, 'id'>): Promise<number> {
    // Allow multiple active goals - don't deactivate existing goals
    return await db.goals.add(goal as Goal);
  },

  async update(id: number, changes: Partial<Goal>): Promise<number> {
    return await db.goals.update(id, changes);
  },

  async delete(id: number): Promise<void> {
    return await db.goals.delete(id);
  },

  async deleteAll(): Promise<void> {
    return await db.goals.clear();
  },
};

export const matchService = {
  async getAll(): Promise<Match[]> {
    return await db.matches.orderBy('date').reverse().toArray();
  },

  async getByDateRange(startDate: Date, endDate: Date): Promise<Match[]> {
    return await db.matches
      .where('date')
      .between(startDate, endDate, true, true)
      .sortBy('date');
  },

  async getByMatchId(matchId: string): Promise<Match | undefined> {
    return await db.matches.get(matchId);
  },

  async getAllMatchIds(): Promise<string[]> {
    const all = await db.matches.toArray();
    return all.map(m => m.matchId);
  },

  async add(match: Match): Promise<string> {
    // Check for duplicate by matchId
    const existing = await db.matches.get(match.matchId);

    if (existing) {
      // Update existing entry instead of adding duplicate
      console.log('[MatchService] Duplicate entry found for matchId:', match.matchId, 'Updating existing entry');
      await db.matches.update(match.matchId, match);
      return match.matchId;
    }

    return await db.matches.add(match);
  },

  async update(matchId: string, changes: Partial<Omit<Match, 'matchId'>>): Promise<number> {
    return await db.matches.update(matchId, changes);
  },

  async delete(matchId: string): Promise<void> {
    return await db.matches.delete(matchId);
  },

  async deleteAll(): Promise<void> {
    return await db.matches.clear();
  },

  async getWinRate(role?: string, champion?: string): Promise<number> {
    let query = db.matches.toCollection();
    if (role) {
      query = query.filter(m => m.role === role);
    }
    if (champion) {
      query = query.filter(m => m.champion === champion);
    }
    const matches = await query.toArray();
    if (matches.length === 0) return 0;
    const wins = matches.filter(m => m.win).length;
    return (wins / matches.length) * 100;
  },
};

export const summonerService = {
  async getByPuuid(puuid: string): Promise<Summoner | undefined> {
    return await db.summoners.get(puuid);
  },

  async getAll(): Promise<Summoner[]> {
    return await db.summoners.toArray();
  },

  async addOrUpdate(summoner: Summoner): Promise<string> {
    // puuid is required and used as primary key
    if (!summoner.puuid || summoner.puuid.trim() === '') {
      throw new Error('Summoner puuid is required');
    }
    return await db.summoners.put(summoner);
  },

  async delete(puuid: string): Promise<void> {
    return await db.summoners.delete(puuid);
  },

  async deleteAll(): Promise<void> {
    return await db.summoners.clear();
  },
};

// ⚠️ CRITICAL: League entry service - ONLY stores RANKED_SOLO_5x5 (solo queue) entries
// This mistake has been made multiple times. DO NOT store any other queue types.
// ⚠️ NOTE: Primary key is leagueId (as per Riot API specification), not puuid.
export const leagueEntryService = {
  /**
   * Get league entry by leagueId
   * ⚠️ CRITICAL: Only returns solo queue entries. Non-solo queue entries are rejected.
   */
  async getByLeagueId(leagueId: string): Promise<(LeagueEntry & { puuid: string; lastUpdated: Date }) | undefined> {
    if (!leagueId || leagueId.trim() === '') {
      return undefined;
    }
    const entry = await db.leagueEntries.get(leagueId);
    // Double-check it's solo queue (safety check)
    if (entry && entry.queueType !== 'RANKED_SOLO_5x5') {
      console.warn('[LeagueEntryService] Found non-solo queue entry in database, deleting:', entry.queueType);
      await db.leagueEntries.delete(leagueId);
      return undefined;
    }
    return entry;
  },

  /**
   * Get league entry by PUUID (solo queue only)
   * ⚠️ CRITICAL: Only returns solo queue entries. Non-solo queue entries are rejected.
   * Note: Uses puuid index to find entry, but primary key is leagueId.
   */
  async getByPuuid(puuid: string): Promise<(LeagueEntry & { puuid: string; lastUpdated: Date }) | undefined> {
    if (!puuid || puuid.trim() === '') {
      return undefined;
    }
    // Use puuid index to find entry
    const entries = await db.leagueEntries.where('puuid').equals(puuid).toArray();
    // Filter for solo queue only (should be only one, but safety check)
    const soloQueueEntries = entries.filter(e => e.queueType === 'RANKED_SOLO_5x5');
    if (soloQueueEntries.length === 0) {
      return undefined;
    }
    // If multiple entries found (shouldn't happen), delete non-solo queue entries
    if (soloQueueEntries.length > 1) {
      console.warn('[LeagueEntryService] Multiple solo queue entries found for puuid, keeping first one');
    }
    // Delete any non-solo queue entries
    for (const entry of entries) {
      if (entry.queueType !== 'RANKED_SOLO_5x5') {
        console.warn('[LeagueEntryService] Found non-solo queue entry in database, deleting:', entry.queueType);
        await db.leagueEntries.delete(entry.leagueId);
      }
    }
    return soloQueueEntries[0];
  },

  /**
   * Add or update league entry (solo queue only)
   * ⚠️ CRITICAL: Only accepts RANKED_SOLO_5x5 entries. Rejects all other queue types.
   * ⚠️ NOTE: leagueId is required and used as primary key (as per Riot API specification).
   */
  async addOrUpdate(puuid: string, entry: LeagueEntry): Promise<string> {
    // ⚠️ CRITICAL: Only allow solo queue entries
    if (entry.queueType !== 'RANKED_SOLO_5x5') {
      throw new Error(`Cannot save non-solo queue entry. Queue type: ${entry.queueType}. Only RANKED_SOLO_5x5 is allowed.`);
    }
    
    if (!puuid || puuid.trim() === '') {
      throw new Error('PUUID is required');
    }

    // ⚠️ CRITICAL: leagueId is required (primary key)
    if (!entry.leagueId || entry.leagueId.trim() === '') {
      throw new Error('LeagueId is required. LeagueId is the unique identifier for league entries according to Riot API specification.');
    }
    
    return await db.leagueEntries.put({
      ...entry,
      puuid,
      lastUpdated: new Date(),
    });
  },

  /**
   * Delete league entry by leagueId
   */
  async deleteByLeagueId(leagueId: string): Promise<void> {
    if (!leagueId || leagueId.trim() === '') {
      return;
    }
    return await db.leagueEntries.delete(leagueId);
  },

  /**
   * Delete league entry by PUUID
   * Note: Finds entry by puuid index and deletes by leagueId (primary key)
   */
  async delete(puuid: string): Promise<void> {
    if (!puuid || puuid.trim() === '') {
      return;
    }
    // Find entry by puuid index
    const entries = await db.leagueEntries.where('puuid').equals(puuid).toArray();
    // Delete all entries for this puuid (should be only one for solo queue)
    for (const entry of entries) {
      await db.leagueEntries.delete(entry.leagueId);
    }
  },

  /**
   * Delete all league entries
   */
  async deleteAll(): Promise<void> {
    return await db.leagueEntries.clear();
  },
};

export const skillGoalService = {
  async getAll(): Promise<SkillGoal[]> {
    return await db.skillGoals.orderBy('createdAt').reverse().toArray();
  },

  async getActive(): Promise<SkillGoal[]> {
    return await db.skillGoals.where('isActive').equals(1).toArray();
  },

  async getByType(type: SkillGoal['type']): Promise<SkillGoal[]> {
    return await db.skillGoals.where('type').equals(type).toArray();
  },

  async add(goal: Omit<SkillGoal, 'id'>): Promise<number> {
    return await db.skillGoals.add(goal as SkillGoal);
  },

  async update(id: number, changes: Partial<SkillGoal>): Promise<number> {
    return await db.skillGoals.update(id, changes);
  },

  async delete(id: number): Promise<void> {
    return await db.skillGoals.delete(id);
  },

  async deleteAll(): Promise<void> {
    return await db.skillGoals.clear();
  },
};

export async function clearAllData(): Promise<void> {
  await rateHistoryService.deleteAll();
  await goalService.deleteAll();
  await matchService.deleteAll();
  await summonerService.deleteAll();
  await leagueEntryService.deleteAll();
  await skillGoalService.deleteAll();
}

