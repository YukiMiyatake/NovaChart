export interface RateHistory {
  matchId: string;   // Riot APIのマッチID（プライマリキー）
  date: Date;
  tier: string;      // IRON, BRONZE, SILVER, GOLD, PLATINUM, EMERALD, DIAMOND, MASTER, GRANDMASTER, CHALLENGER
  rank: string;      // IV, III, II, I
  lp: number;
  wins: number;
  losses: number;
}

export interface Goal {
  id?: number;
  targetDate: Date;
  targetTier: string;
  targetRank: string;
  targetLP: number;
  createdAt: Date;
  isActive: boolean;
}

export interface Match {
  matchId: string;   // Riot APIのマッチID（プライマリキー）
  date: Date;
  win: boolean;
  role?: string;
  champion?: string;
  kda?: { kills: number; deaths: number; assists: number };
  csAt10?: number;
  visionScore?: number;
  killParticipation?: number;
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  memo?: string;
  // 追加の詳細フィールド
  lane?: string; // TOP, JUNGLE, MID, ADC, SUPPORT
  damageDealt?: number; // 総ダメージ
  damageTaken?: number; // 受けたダメージ
  damageToChampions?: number; // チャンピオンへのダメージ
  goldEarned?: number; // 獲得ゴールド
  csPerMin?: number; // 分あたりのCS
  gameDuration?: number; // 試合時間（秒）
  totalMinionsKilled?: number; // 総ミニオンキル数
  neutralMinionsKilled?: number; // ジャングルミニオンキル数
}

export interface Summoner {
  id?: string; // Optional - not required, puuid is the primary identifier
  puuid: string;
  name: string;
  profileIconId: number;
  summonerLevel: number;
  region: string;
  lastUpdated: Date;
}

export interface LeagueEntry {
  leagueId: string;
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  veteran: boolean;
  inactive: boolean;
  freshBlood: boolean;
  hotStreak: boolean;
}

export type SkillGoalType = 'CS_AT_10' | 'KDA' | 'VISION_SCORE' | 'DAMAGE' | 'CSPERMIN' | 'DAMAGE_PER_MIN';

export interface SkillGoal {
  id?: number;
  type: SkillGoalType;
  targetValue: number;
  lanes?: string[]; // TOP, JUNGLE, MID, ADC, SUPPORT (optional, empty array means all lanes)
  createdAt: Date;
  isActive: boolean;
  description?: string; // ユーザーが設定した説明（オプション）
  // 後方互換性のため（既存データ用）
  lane?: string; // 非推奨: lanesを使用してください
}

