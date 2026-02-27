import { Match } from '@/types';

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export interface TimeOfDayStatistics {
  timeOfDay: TimeOfDay;
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  averageKDA: number;
  averageKills: number;
  averageDeaths: number;
  averageAssists: number;
  averageCS: number;
  averageCSPerMin: number;
  averageDamage: number;
  averageDamagePerMin: number;
  averageVisionScore: number;
  averageKillParticipation: number;
}

export interface TimeOfDayComparison {
  statistics: Map<TimeOfDay, TimeOfDayStatistics>;
  bestTimeOfDay: TimeOfDay | null;
  worstTimeOfDay: TimeOfDay | null;
}

/**
 * 時間帯別の統計を計算
 */
export function calculateTimeOfDayStatistics(matches: Match[]): TimeOfDayComparison {
  const timeOfDayMap: Map<TimeOfDay, Match[]> = new Map([
    ['morning', []],
    ['afternoon', []],
    ['evening', []],
    ['night', []],
  ]);

  // 時間帯別に試合を分類
  matches.forEach(match => {
    if (match.timeOfDay) {
      const matchesForTime = timeOfDayMap.get(match.timeOfDay) || [];
      matchesForTime.push(match);
      timeOfDayMap.set(match.timeOfDay, matchesForTime);
    }
  });

  // 各時間帯の統計を計算
  const statistics: Map<TimeOfDay, TimeOfDayStatistics> = new Map();
  
  timeOfDayMap.forEach((timeMatches, timeOfDay) => {
    if (timeMatches.length === 0) {
      statistics.set(timeOfDay, createEmptyStats(timeOfDay));
      return;
    }

    const wins = timeMatches.filter(m => m.win).length;
    const losses = timeMatches.length - wins;
    const winRate = (wins / timeMatches.length) * 100;

    // KDA計算
    let totalKills = 0;
    let totalDeaths = 0;
    let totalAssists = 0;
    let kdaCount = 0;

    timeMatches.forEach(match => {
      if (match.kda) {
        totalKills += match.kda.kills;
        totalDeaths += match.kda.deaths;
        totalAssists += match.kda.assists;
        kdaCount++;
      }
    });

    const averageKills = kdaCount > 0 ? totalKills / kdaCount : 0;
    const averageDeaths = kdaCount > 0 ? totalDeaths / kdaCount : 0;
    const averageAssists = kdaCount > 0 ? totalAssists / kdaCount : 0;
    const averageKDA = averageDeaths > 0 
      ? (averageKills + averageAssists) / averageDeaths 
      : averageKills + averageAssists;

    // CS計算
    let totalCS = 0;
    let totalCSPerMin = 0;
    let csCount = 0;

    timeMatches.forEach(match => {
      if (match.totalMinionsKilled !== undefined && match.neutralMinionsKilled !== undefined) {
        totalCS += match.totalMinionsKilled + match.neutralMinionsKilled;
        csCount++;
      }
      if (match.csPerMin !== undefined) {
        totalCSPerMin += match.csPerMin;
      }
    });

    const averageCS = csCount > 0 ? totalCS / csCount : 0;
    const averageCSPerMin = timeMatches.filter(m => m.csPerMin !== undefined).length > 0
      ? totalCSPerMin / timeMatches.filter(m => m.csPerMin !== undefined).length
      : 0;

    // ダメージ計算
    let totalDamage = 0;
    let totalGameDuration = 0;
    let damageCount = 0;

    timeMatches.forEach(match => {
      if (match.damageToChampions !== undefined) {
        totalDamage += match.damageToChampions;
        damageCount++;
      }
      if (match.gameDuration !== undefined) {
        totalGameDuration += match.gameDuration;
      }
    });

    const averageDamage = damageCount > 0 ? totalDamage / damageCount : 0;
    const averageDamagePerMin = totalGameDuration > 0
      ? (totalDamage / damageCount) / (totalGameDuration / 60 / damageCount)
      : 0;

    // ビジョンスコア計算
    let totalVisionScore = 0;
    let visionScoreCount = 0;

    timeMatches.forEach(match => {
      if (match.visionScore !== undefined) {
        totalVisionScore += match.visionScore;
        visionScoreCount++;
      }
    });

    const averageVisionScore = visionScoreCount > 0 ? totalVisionScore / visionScoreCount : 0;

    // キル参加率計算
    let totalKillParticipation = 0;
    let killParticipationCount = 0;

    timeMatches.forEach(match => {
      if (match.killParticipation !== undefined) {
        totalKillParticipation += match.killParticipation;
        killParticipationCount++;
      }
    });

    const averageKillParticipation = killParticipationCount > 0 
      ? totalKillParticipation / killParticipationCount 
      : 0;

    statistics.set(timeOfDay, {
      timeOfDay,
      totalGames: timeMatches.length,
      wins,
      losses,
      winRate: Math.round(winRate * 100) / 100,
      averageKDA: Math.round(averageKDA * 100) / 100,
      averageKills: Math.round(averageKills * 100) / 100,
      averageDeaths: Math.round(averageDeaths * 100) / 100,
      averageAssists: Math.round(averageAssists * 100) / 100,
      averageCS: Math.round(averageCS),
      averageCSPerMin: Math.round(averageCSPerMin * 10) / 10,
      averageDamage: Math.round(averageDamage),
      averageDamagePerMin: Math.round(averageDamagePerMin),
      averageVisionScore: Math.round(averageVisionScore * 10) / 10,
      averageKillParticipation: Math.round(averageKillParticipation * 10) / 10,
    });
  });

  // 最高・最低勝率の時間帯を特定
  let bestTimeOfDay: TimeOfDay | null = null;
  let worstTimeOfDay: TimeOfDay | null = null;
  let bestWinRate = -1;
  let worstWinRate = 101;

  statistics.forEach((stats, timeOfDay) => {
    if (stats.totalGames > 0) {
      if (stats.winRate > bestWinRate) {
        bestWinRate = stats.winRate;
        bestTimeOfDay = timeOfDay;
      }
      if (stats.winRate < worstWinRate) {
        worstWinRate = stats.winRate;
        worstTimeOfDay = timeOfDay;
      }
    }
  });

  return {
    statistics,
    bestTimeOfDay,
    worstTimeOfDay,
  };
}

function createEmptyStats(timeOfDay: TimeOfDay): TimeOfDayStatistics {
  return {
    timeOfDay,
    totalGames: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    averageKDA: 0,
    averageKills: 0,
    averageDeaths: 0,
    averageAssists: 0,
    averageCS: 0,
    averageCSPerMin: 0,
    averageDamage: 0,
    averageDamagePerMin: 0,
    averageVisionScore: 0,
    averageKillParticipation: 0,
  };
}

/**
 * 時間帯名を日本語に変換
 */
export function getTimeOfDayName(timeOfDay: TimeOfDay): string {
  switch (timeOfDay) {
    case 'morning':
      return '朝 (5:00-12:00)';
    case 'afternoon':
      return '昼 (12:00-17:00)';
    case 'evening':
      return '夕方 (17:00-22:00)';
    case 'night':
      return '夜 (22:00-5:00)';
    default:
      return timeOfDay;
  }
}

