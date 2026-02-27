/**
 * Lane Statistics Calculation
 * 
 * レーン別の統計を計算します。
 * TOP, JUNGLE, MID, ADC, SUPPORTごとの勝率、平均KDA、平均CS、平均ダメージ等を集計します。
 */

import { Match } from '@/types';

export type Lane = 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT';

export interface LaneStatistics {
  lane: Lane;
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
  averageGoldEarned: number;
  averageGameDuration: number;
  averageKillParticipation: number;
}

export interface LaneStatisticsWithHistory extends LaneStatistics {
  history: Array<{
    date: Date;
    win: boolean;
    kda: number;
    csPerMin: number;
    damagePerMin: number;
    visionScore: number;
  }>;
}

/**
 * レーン別の統計を計算
 * @param matches 試合データの配列
 * @returns レーン別統計のマップ
 */
export function calculateLaneStatistics(matches: Match[]): Map<Lane, LaneStatistics> {
  const laneStats = new Map<Lane, LaneStatistics>();

  // レーンごとに試合をグループ化
  const laneMatches = new Map<Lane, Match[]>();
  
  matches.forEach(match => {
    if (match.lane && ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'].includes(match.lane)) {
      const lane = match.lane as Lane;
      if (!laneMatches.has(lane)) {
        laneMatches.set(lane, []);
      }
      laneMatches.get(lane)!.push(match);
    }
  });

  // 各レーンの統計を計算
  laneMatches.forEach((laneMatches, lane) => {
    const stats = calculateStatsForLane(lane, laneMatches);
    laneStats.set(lane, stats);
  });

  return laneStats;
}

/**
 * 特定レーンの統計を計算
 */
function calculateStatsForLane(lane: Lane, matches: Match[]): LaneStatistics {
  if (matches.length === 0) {
    return createEmptyStats(lane);
  }

  const wins = matches.filter(m => m.win).length;
  const losses = matches.length - wins;
  const winRate = (wins / matches.length) * 100;

  // KDA計算
  let totalKills = 0;
  let totalDeaths = 0;
  let totalAssists = 0;
  let kdaCount = 0;

  matches.forEach(match => {
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

  matches.forEach(match => {
    if (match.totalMinionsKilled !== undefined && match.neutralMinionsKilled !== undefined) {
      totalCS += match.totalMinionsKilled + match.neutralMinionsKilled;
      csCount++;
    }
    if (match.csPerMin !== undefined) {
      totalCSPerMin += match.csPerMin;
    }
  });

  const averageCS = csCount > 0 ? totalCS / csCount : 0;
  const averageCSPerMin = matches.filter(m => m.csPerMin !== undefined).length > 0
    ? totalCSPerMin / matches.filter(m => m.csPerMin !== undefined).length
    : 0;

  // ダメージ計算
  let totalDamage = 0;
  let totalGameDuration = 0;
  let damageCount = 0;

  matches.forEach(match => {
    if (match.damageToChampions !== undefined) {
      totalDamage += match.damageToChampions;
      damageCount++;
    }
    if (match.gameDuration !== undefined) {
      totalGameDuration += match.gameDuration;
    }
  });

  const averageDamage = damageCount > 0 ? totalDamage / damageCount : 0;
  const averageGameDuration = matches.filter(m => m.gameDuration !== undefined).length > 0
    ? totalGameDuration / matches.filter(m => m.gameDuration !== undefined).length
    : 0;
  const averageDamagePerMin = averageGameDuration > 0
    ? (averageDamage / averageGameDuration) * 60
    : 0;

  // ビジョンスコア計算
  let totalVisionScore = 0;
  let visionCount = 0;

  matches.forEach(match => {
    if (match.visionScore !== undefined) {
      totalVisionScore += match.visionScore;
      visionCount++;
    }
  });

  const averageVisionScore = visionCount > 0 ? totalVisionScore / visionCount : 0;

  // ゴールド計算
  let totalGold = 0;
  let goldCount = 0;

  matches.forEach(match => {
    if (match.goldEarned !== undefined) {
      totalGold += match.goldEarned;
      goldCount++;
    }
  });

  const averageGoldEarned = goldCount > 0 ? totalGold / goldCount : 0;

  // キル参加率計算
  let totalKillParticipation = 0;
  let participationCount = 0;

  matches.forEach(match => {
    if (match.killParticipation !== undefined) {
      totalKillParticipation += match.killParticipation;
      participationCount++;
    }
  });

  const averageKillParticipation = participationCount > 0 
    ? totalKillParticipation / participationCount 
    : 0;

  return {
    lane,
    totalGames: matches.length,
    wins,
    losses,
    winRate: Math.round(winRate * 10) / 10,
    averageKDA: Math.round(averageKDA * 100) / 100,
    averageKills: Math.round(averageKills * 10) / 10,
    averageDeaths: Math.round(averageDeaths * 10) / 10,
    averageAssists: Math.round(averageAssists * 10) / 10,
    averageCS: Math.round(averageCS),
    averageCSPerMin: Math.round(averageCSPerMin * 10) / 10,
    averageDamage: Math.round(averageDamage),
    averageDamagePerMin: Math.round(averageDamagePerMin),
    averageVisionScore: Math.round(averageVisionScore * 10) / 10,
    averageGoldEarned: Math.round(averageGoldEarned),
    averageGameDuration: Math.round(averageGameDuration),
    averageKillParticipation: Math.round(averageKillParticipation * 10) / 10,
  };
}

/**
 * 空の統計データを作成
 */
function createEmptyStats(lane: Lane): LaneStatistics {
  return {
    lane,
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
    averageGoldEarned: 0,
    averageGameDuration: 0,
    averageKillParticipation: 0,
  };
}

/**
 * レーン別統計に履歴データを追加
 * @param matches 試合データの配列
 * @returns レーン別統計（履歴付き）のマップ
 */
export function calculateLaneStatisticsWithHistory(matches: Match[]): Map<Lane, LaneStatisticsWithHistory> {
  const stats = calculateLaneStatistics(matches);
  const statsWithHistory = new Map<Lane, LaneStatisticsWithHistory>();

  // レーンごとに試合をグループ化
  const laneMatches = new Map<Lane, Match[]>();
  
  matches.forEach(match => {
    if (match.lane && ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'].includes(match.lane)) {
      const lane = match.lane as Lane;
      if (!laneMatches.has(lane)) {
        laneMatches.set(lane, []);
      }
      laneMatches.get(lane)!.push(match);
    }
  });

  stats.forEach((stat, lane) => {
    const laneMatchList = laneMatches.get(lane) || [];
    
    // 日付順にソート
    const sortedMatches = [...laneMatchList].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const history = sortedMatches.map(match => {
      const kda = match.kda && match.kda.deaths > 0
        ? (match.kda.kills + match.kda.assists) / match.kda.deaths
        : match.kda
        ? match.kda.kills + match.kda.assists
        : 0;

      const gameDurationMinutes = match.gameDuration ? match.gameDuration / 60 : 1;
      const damagePerMin = match.damageToChampions 
        ? match.damageToChampions / gameDurationMinutes 
        : 0;

      return {
        date: match.date,
        win: match.win,
        kda: Math.round(kda * 100) / 100,
        csPerMin: match.csPerMin || 0,
        damagePerMin: Math.round(damagePerMin),
        visionScore: match.visionScore || 0,
      };
    });

    statsWithHistory.set(lane, {
      ...stat,
      history,
    });
  });

  return statsWithHistory;
}

/**
 * レーン名を日本語に変換
 */
export function getLaneName(lane: Lane): string {
  const laneNames: Record<Lane, string> = {
    'TOP': 'トップ',
    'JUNGLE': 'ジャングル',
    'MID': 'ミッド',
    'ADC': 'ADC',
    'SUPPORT': 'サポート',
  };
  return laneNames[lane] || lane;
}

