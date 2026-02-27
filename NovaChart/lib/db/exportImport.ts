/**
 * Export/Import DB data as JSON file.
 * Uses client-side only (IndexedDB); safe to call from browser.
 */

import { db } from './index';
import type { RateHistory, Goal, Match, Summoner, LeagueEntry, SkillGoal } from '@/types';

const EXPORT_VERSION = 1;
const DB_LABEL = 'NovaChartDB_v6';

const DATE_KEYS: Record<string, string[]> = {
  rateHistory: ['date'],
  goals: ['targetDate', 'createdAt'],
  matches: ['date'],
  summoners: ['lastUpdated'],
  leagueEntries: ['lastUpdated'],
  skillGoals: ['createdAt'],
};

/** Exported file format: date fields are ISO strings */
export interface ExportPayload {
  version: number;
  dbLabel: string;
  exportedAt: string;
  rateHistory: Record<string, unknown>[];
  goals: Record<string, unknown>[];
  matches: Record<string, unknown>[];
  summoners: Record<string, unknown>[];
  leagueEntries: Record<string, unknown>[];
  skillGoals: Record<string, unknown>[];
}

/** Serialize Date fields to ISO string for JSON export */
function serializeDates<T extends Record<string, unknown>>(
  rows: T[],
  dateKeys: string[]
): Record<string, unknown>[] {
  return rows.map((row) => {
    const out = { ...row } as Record<string, unknown>;
    for (const key of dateKeys) {
      const v = out[key];
      if (v instanceof Date) out[key] = v.toISOString();
      else if (typeof v === 'number' && (key === 'date' || key.includes('Date') || key.includes('Updated')))
        out[key] = new Date(v).toISOString();
    }
    return out;
  });
}

/** Restore Date fields from ISO string after JSON parse */
function deserializeDates<T extends Record<string, unknown>>(
  rows: Record<string, unknown>[],
  dateKeys: string[]
): T[] {
  return rows.map((row) => {
    const out = { ...row } as Record<string, unknown>;
    for (const key of dateKeys) {
      const v = out[key];
      if (typeof v === 'string') out[key] = new Date(v);
      else if (typeof v === 'number') out[key] = new Date(v);
    }
    return out as T[];
  });
}

/** Export all DB tables to a JSON object (in-memory). */
export async function exportDbToObject(): Promise<ExportPayload> {
  const [rateHistory, goals, matches, summoners, leagueEntries, skillGoals] = await Promise.all([
    db.rateHistory.toArray(),
    db.goals.toArray(),
    db.matches.toArray(),
    db.summoners.toArray(),
    db.leagueEntries.toArray(),
    db.skillGoals.toArray(),
  ]);

  return {
    version: EXPORT_VERSION,
    dbLabel: DB_LABEL,
    exportedAt: new Date().toISOString(),
    rateHistory: serializeDates(rateHistory, DATE_KEYS.rateHistory),
    goals: serializeDates(goals, DATE_KEYS.goals),
    matches: serializeDates(matches, DATE_KEYS.matches),
    summoners: serializeDates(summoners, DATE_KEYS.summoners),
    leagueEntries: serializeDates(leagueEntries, DATE_KEYS.leagueEntries),
    skillGoals: serializeDates(skillGoals, DATE_KEYS.skillGoals),
  };
}

/** Trigger download of DB export as a JSON file. */
export async function exportDbToFile(filename?: string): Promise<void> {
  const payload = await exportDbToObject();
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `novachart-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Options for import */
export interface ImportOptions {
  /** If true, merge with existing data (skip duplicates). If false, clear tables then import. */
  merge?: boolean;
}

/** Import DB from a JSON file (File object from input). */
export async function importDbFromFile(file: File, options: ImportOptions = {}): Promise<{ imported: number; errors: string[] }> {
  const { merge = true } = options;
  const errors: string[] = [];
  let imported = 0;

  const text = await file.text();
  let data: ExportPayload;
  try {
    data = JSON.parse(text) as ExportPayload;
  } catch {
    throw new Error('無効なJSONファイルです');
  }

  if (data.version !== EXPORT_VERSION || !data.dbLabel) {
    throw new Error('サポートされていないエクスポート形式です');
  }

  const tables = [
    'rateHistory',
    'goals',
    'matches',
    'summoners',
    'leagueEntries',
    'skillGoals',
  ] as const;

  if (!merge) {
    for (const table of tables) {
      await (db[table] as { clear: () => Promise<void> }).clear();
    }
  }

  // rateHistory
  if (Array.isArray(data.rateHistory)) {
    const rows = deserializeDates<RateHistory>(data.rateHistory as Record<string, unknown>[], DATE_KEYS.rateHistory);
    if (merge) {
      const existing = await db.rateHistory.toArray();
      const existingIds = new Set(existing.map((x) => x.matchId));
      const toAdd = rows.filter((r) => r.matchId && !existingIds.has(r.matchId));
      if (toAdd.length) {
        await db.rateHistory.bulkAdd(toAdd);
        imported += toAdd.length;
      }
    } else {
      if (rows.length) {
        await db.rateHistory.bulkAdd(rows);
        imported += rows.length;
      }
    }
  }

  // goals (auto-increment id; add as new)
  if (Array.isArray(data.goals)) {
    const rows = deserializeDates<Goal>(data.goals as Record<string, unknown>[], DATE_KEYS.goals);
    const toAdd = rows.map(({ id: _id, ...rest }) => rest as Goal);
    if (toAdd.length) {
      await db.goals.bulkAdd(toAdd);
      imported += toAdd.length;
    }
  }

  // matches
  if (Array.isArray(data.matches)) {
    const rows = deserializeDates<Match>(data.matches as Record<string, unknown>[], DATE_KEYS.matches);
    if (merge) {
      const existing = await db.matches.toArray();
      const existingIds = new Set(existing.map((x) => x.matchId));
      const toAdd = rows.filter((r) => r.matchId && !existingIds.has(r.matchId));
      if (toAdd.length) {
        await db.matches.bulkAdd(toAdd);
        imported += toAdd.length;
      }
    } else {
      if (rows.length) {
        await db.matches.bulkAdd(rows);
        imported += rows.length;
      }
    }
  }

  // summoners (put = overwrite by puuid)
  if (Array.isArray(data.summoners)) {
    const rows = deserializeDates<Summoner>(data.summoners as Record<string, unknown>[], DATE_KEYS.summoners);
    for (const row of rows) {
      if (row.puuid) {
        try {
          await db.summoners.put(row);
          imported++;
        } catch (e) {
          errors.push(`summoner ${row.puuid}: ${String(e)}`);
        }
      }
    }
  }

  // leagueEntries (solo only; put by leagueId)
  if (Array.isArray(data.leagueEntries)) {
    const rows = deserializeDates<LeagueEntry & { puuid: string; lastUpdated: Date }>(
      data.leagueEntries as Record<string, unknown>[],
      DATE_KEYS.leagueEntries
    );
    for (const row of rows) {
      if (row.queueType !== 'RANKED_SOLO_5x5') continue;
      if (row.leagueId && row.puuid) {
        try {
          await db.leagueEntries.put({ ...row, lastUpdated: row.lastUpdated ?? new Date() });
          imported++;
        } catch (e) {
          errors.push(`leagueEntry ${row.leagueId}: ${String(e)}`);
        }
      }
    }
  }

  // skillGoals (auto-increment; add as new)
  if (Array.isArray(data.skillGoals)) {
    const rows = deserializeDates<SkillGoal>(data.skillGoals as Record<string, unknown>[], DATE_KEYS.skillGoals);
    const toAdd = rows.map(({ id: _id, ...rest }) => rest as SkillGoal);
    if (toAdd.length) {
      await db.skillGoals.bulkAdd(toAdd);
      imported += toAdd.length;
    }
  }

  return { imported, errors };
}
