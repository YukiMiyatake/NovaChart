/**
 * Win/Loss Analysis
 * 
 * 勝利試合と敗北試合のデータを比較し、改善すべきポイントを分析します。
 */

import { Match } from '@/types';

export type Lane = 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT';

export interface LaneWinLossAnalysis {
  lane: Lane;
  analysis: WinLossComparison | null;
}

export interface WinLossComparison {
  wins: {
    count: number;
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
    averageKillParticipation: number;
    averageGameDuration: number;
  };
  losses: {
    count: number;
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
    averageKillParticipation: number;
    averageGameDuration: number;
  };
  differences: {
    kda: number;
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
    csPerMin: number;
    damage: number;
    damagePerMin: number;
    visionScore: number;
    goldEarned: number;
    killParticipation: number;
    gameDuration: number;
  };
  improvementSuggestions: ImprovementSuggestion[];
}

export interface ImprovementSuggestion {
  category: string;
  metric: string;
  currentValue: number;
  targetValue: number;
  difference: number;
  priority: 'high' | 'medium' | 'low';
  description: string;
}

/**
 * 勝利試合と敗北試合の比較分析を実行
 * @param matches 試合データの配列
 * @returns 勝敗比較分析結果
 */
export function analyzeWinLoss(matches: Match[]): WinLossComparison | null {
  if (matches.length === 0) {
    return null;
  }

  const wins = matches.filter(m => m.win);
  const losses = matches.filter(m => !m.win);

  if (wins.length === 0 || losses.length === 0) {
    return null;
  }

  const winStats = calculateAverageStats(wins);
  const lossStats = calculateAverageStats(losses);

  const differences = {
    kda: winStats.averageKDA - lossStats.averageKDA,
    kills: winStats.averageKills - lossStats.averageKills,
    deaths: winStats.averageDeaths - lossStats.averageDeaths,
    assists: winStats.averageAssists - lossStats.averageAssists,
    cs: winStats.averageCS - lossStats.averageCS,
    csPerMin: winStats.averageCSPerMin - lossStats.averageCSPerMin,
    damage: winStats.averageDamage - lossStats.averageDamage,
    damagePerMin: winStats.averageDamagePerMin - lossStats.averageDamagePerMin,
    visionScore: winStats.averageVisionScore - lossStats.averageVisionScore,
    goldEarned: winStats.averageGoldEarned - lossStats.averageGoldEarned,
    killParticipation: winStats.averageKillParticipation - lossStats.averageKillParticipation,
    gameDuration: winStats.averageGameDuration - lossStats.averageGameDuration,
  };

  const improvementSuggestions = generateImprovementSuggestions(
    winStats,
    lossStats,
    differences
  );

  return {
    wins: {
      count: wins.length,
      ...winStats,
    },
    losses: {
      count: losses.length,
      ...lossStats,
    },
    differences,
    improvementSuggestions,
  };
}

/**
 * 試合データの配列から平均統計を計算
 */
function calculateAverageStats(matches: Match[]): {
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
  averageKillParticipation: number;
  averageGameDuration: number;
} {
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
 * 改善提案を生成
 */
function generateImprovementSuggestions(
  winStats: ReturnType<typeof calculateAverageStats>,
  lossStats: ReturnType<typeof calculateAverageStats>,
  differences: WinLossComparison['differences']
): ImprovementSuggestion[] {
  const suggestions: ImprovementSuggestion[] = [];

  // デス数の改善（優先度: 高）
  // 勝利試合の方がデス数が少ない（良い）場合のみ提案
  if (differences.deaths < -1) {
    suggestions.push({
      category: 'サバイバル',
      metric: '平均デス数',
      currentValue: lossStats.averageDeaths,
      targetValue: winStats.averageDeaths,
      difference: Math.abs(differences.deaths),
      priority: 'high',
      description: `敗北試合では平均${lossStats.averageDeaths.toFixed(1)}デス、勝利試合では${winStats.averageDeaths.toFixed(1)}デスです。デス数を${Math.abs(differences.deaths).toFixed(1)}減らすことで勝率向上が期待できます。`,
    });
  }

  // CS/分の改善（優先度: 高）
  // 勝利試合の方がCS/分が高い（良い）場合のみ提案
  if (differences.csPerMin > 1) {
    suggestions.push({
      category: 'ファーミング',
      metric: '平均CS/分',
      currentValue: lossStats.averageCSPerMin,
      targetValue: winStats.averageCSPerMin,
      difference: differences.csPerMin,
      priority: 'high',
      description: `敗北試合では平均${lossStats.averageCSPerMin.toFixed(1)}CS/分、勝利試合では${winStats.averageCSPerMin.toFixed(1)}CS/分です。CS/分を${differences.csPerMin.toFixed(1)}向上させることで経済力が向上します。`,
    });
  }

  // ダメージ/分の改善（優先度: 高）
  // 勝利試合の方がダメージ/分が高い（良い）場合のみ提案
  if (differences.damagePerMin > 200) {
    suggestions.push({
      category: 'ダメージ',
      metric: '平均ダメージ/分',
      currentValue: lossStats.averageDamagePerMin,
      targetValue: winStats.averageDamagePerMin,
      difference: differences.damagePerMin,
      priority: 'high',
      description: `敗北試合では平均${lossStats.averageDamagePerMin.toLocaleString()}ダメージ/分、勝利試合では${winStats.averageDamagePerMin.toLocaleString()}ダメージ/分です。ダメージ/分を${differences.damagePerMin.toLocaleString()}向上させることで影響力が向上します。`,
    });
  }

  // ビジョンスコアの改善（優先度: 中）
  // 勝利試合の方がビジョンスコアが高い（良い）場合のみ提案
  if (differences.visionScore > 5) {
    suggestions.push({
      category: 'ビジョン',
      metric: '平均ビジョンスコア',
      currentValue: lossStats.averageVisionScore,
      targetValue: winStats.averageVisionScore,
      difference: differences.visionScore,
      priority: 'medium',
      description: `敗北試合では平均${lossStats.averageVisionScore.toFixed(1)}ビジョンスコア、勝利試合では${winStats.averageVisionScore.toFixed(1)}です。ビジョンスコアを${differences.visionScore.toFixed(1)}向上させることでマップコントロールが向上します。`,
    });
  }

  // キル参加率の改善（優先度: 中）
  // 勝利試合の方がキル参加率が高い（良い）場合のみ提案
  if (differences.killParticipation > 5) {
    suggestions.push({
      category: 'チームプレイ',
      metric: '平均キル参加率',
      currentValue: lossStats.averageKillParticipation,
      targetValue: winStats.averageKillParticipation,
      difference: differences.killParticipation,
      priority: 'medium',
      description: `敗北試合では平均${lossStats.averageKillParticipation.toFixed(1)}%キル参加率、勝利試合では${winStats.averageKillParticipation.toFixed(1)}%です。キル参加率を${differences.killParticipation.toFixed(1)}%向上させることでチームへの貢献が向上します。`,
    });
  }

  // KDAの改善（優先度: 中）
  // 勝利試合の方がKDAが高い（良い）場合のみ提案
  if (differences.kda > 0.5) {
    suggestions.push({
      category: 'パフォーマンス',
      metric: '平均KDA',
      currentValue: lossStats.averageKDA,
      targetValue: winStats.averageKDA,
      difference: differences.kda,
      priority: 'medium',
      description: `敗北試合では平均KDA${lossStats.averageKDA.toFixed(2)}、勝利試合では${winStats.averageKDA.toFixed(2)}です。KDAを${differences.kda.toFixed(2)}向上させることで全体的なパフォーマンスが向上します。`,
    });
  }

  // アシスト数の改善（優先度: 低）
  // 勝利試合の方がアシスト数が高い（良い）場合のみ提案
  if (differences.assists > 1) {
    suggestions.push({
      category: 'チームプレイ',
      metric: '平均アシスト数',
      currentValue: lossStats.averageAssists,
      targetValue: winStats.averageAssists,
      difference: differences.assists,
      priority: 'low',
      description: `敗北試合では平均${lossStats.averageAssists.toFixed(1)}アシスト、勝利試合では${winStats.averageAssists.toFixed(1)}アシストです。アシスト数を${differences.assists.toFixed(1)}向上させることでチームへの貢献が向上します。`,
    });
  }

  // 優先度順にソート（high > medium > low）
  suggestions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return suggestions;
}

/**
 * 差分のパーセンテージを計算
 */
export function calculateDifferencePercentage(winValue: number, lossValue: number): number {
  if (lossValue === 0) return 0;
  return Math.round(((winValue - lossValue) / lossValue) * 100 * 10) / 10;
}

/**
 * レーン別の勝敗分析を実行
 * @param matches 試合データの配列
 * @returns レーン別の勝敗分析結果
 */
export function analyzeWinLossByLane(matches: Match[]): LaneWinLossAnalysis[] {
  const lanes: Lane[] = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
  const results: LaneWinLossAnalysis[] = [];

  lanes.forEach(lane => {
    const laneMatches = matches.filter(m => m.lane === lane);
    const analysis = analyzeWinLoss(laneMatches);
    results.push({
      lane,
      analysis,
    });
  });

  return results;
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

