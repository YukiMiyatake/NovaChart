import { Summoner, LeagueEntry, Match } from '@/types';
import { logger } from '@/lib/utils/logger';
import { handleRiotApiError } from '@/lib/utils/errorHandler';

// Riot Games API base URLs
// Platform routing (for summoner-v4, league-v4, etc.)
// All regions use the same base URL structure: https://{region}.api.riotgames.com
// For League of Legends, regions are: jp1, kr, na1, euw1, eun1, etc.
const RIOT_API_BASE_URL = 'https://{region}.api.riotgames.com';

// Regional routing (for account-v1, match-v5, etc.)
// Regional routing values: ASIA, AMERICAS, EUROPE
const RIOT_API_REGIONAL_BASE_URL = 'https://{routing}.api.riotgames.com';

// Map platform regions to regional routing
// Platform regions (jp1, kr, na1, etc.) are used for summoner-v4, league-v4
// Regional routing (asia, americas, europe) is used for account-v1, match-v5
// Example: jp1 -> asia, na1 -> americas, euw1 -> europe
function getRegionalRouting(platformRegion: string): string {
  const asiaRegions = ['jp1', 'kr', 'oc1', 'ph2', 'sg2', 'th2', 'tw2', 'vn2'];
  const americasRegions = ['na1', 'br1', 'la1', 'la2'];
  const europeRegions = ['euw1', 'eun1', 'tr1', 'ru'];
  
  if (asiaRegions.includes(platformRegion.toLowerCase())) {
    return 'asia';
  } else if (americasRegions.includes(platformRegion.toLowerCase())) {
    return 'americas';
  } else if (europeRegions.includes(platformRegion.toLowerCase())) {
    return 'europe';
  }
  
  // Default to asia for unknown regions
  return 'asia';
}

export interface RiotApiError {
  status: {
    status_code: number;
    message: string;
  };
}

export class RiotApiClient {
  private apiKey: string;
  private region: string;

  constructor(apiKey: string, region: string = 'jp1') {
    this.apiKey = apiKey;
    this.region = region;
  }

  private async fetchRiotApi<T>(url: string, endpointName?: string): Promise<T> {
    logger.debug(`[Riot API] Requesting: ${url}`);
    logger.debug(`[Riot API] Endpoint: ${endpointName || 'unknown'}`);
    logger.debug(`[Riot API] Region: ${this.region}`);
    logger.debug(`[Riot API] API Key prefix: ${this.apiKey.substring(0, 10)}...`);
    
    const response = await fetch(url, {
      headers: {
        'X-Riot-Token': this.apiKey,
      },
    });

    logger.debug(`[Riot API] Response status: ${response.status} ${response.statusText}`);
    logger.debug(`[Riot API] Response headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      let errorMessage = '';
      let errorDetails: any = null;
      
      // Try to parse error response
      try {
        const errorData = await response.json();
        errorDetails = errorData;
        logger.error(`[Riot API] Error response:`, JSON.stringify(errorData, null, 2));
        
        if (errorData.status) {
          errorMessage = errorData.status.message || response.statusText;
        } else {
          errorMessage = errorData.message || response.statusText;
        }
      } catch (e) {
        const text = await response.text();
        logger.error(`[Riot API] Error response (text):`, text);
        errorMessage = response.statusText;
      }

      // Extract API endpoint from URL for better error messages
      const urlObj = new URL(url);
      const apiPath = urlObj.pathname;
      const endpointInfo = endpointName || apiPath;

      // Create error object with status code
      const error = new Error(`Riot API Error: ${response.status} - ${errorMessage}`);
      (error as any).statusCode = response.status;
      
      // Use error handler to get user-friendly message
      const userFriendlyMessage = handleRiotApiError(error, endpointInfo);
      throw new Error(userFriendlyMessage);
    }

    return response.json();
  }

  private getBaseUrl(): string {
    // Platform routing for summoner-v4, league-v4, etc.
    // For League of Legends: https://{region}.api.riotgames.com
    // Valid regions: jp1, kr, na1, euw1, eun1, br1, la1, la2, oc1, tr1, ru
    return RIOT_API_BASE_URL.replace('{region}', this.region);
  }

  private getRegionalBaseUrl(): string {
    // Regional routing for account-v1, match-v5, etc.
    // Converts platform region (jp1, kr, na1, etc.) to regional routing (asia, americas, europe)
    // Example: jp1 -> asia, na1 -> americas, euw1 -> europe
    // Returns: https://asia.api.riotgames.com, https://americas.api.riotgames.com, or https://europe.api.riotgames.com
    const routing = getRegionalRouting(this.region);
    return RIOT_API_REGIONAL_BASE_URL.replace('{routing}', routing);
  }

  // Note: getSummonerByName and getSummonerById are deprecated.
  // Use getAccountByRiotId and getSummonerByPuuid instead.

  async getSummonerByPuuid(puuid: string): Promise<Summoner> {
    const url = `${this.getBaseUrl()}/lol/summoner/v4/summoners/by-puuid/${puuid}`;
    const data = await this.fetchRiotApi<{
      id: string;
      accountId: string;
      puuid: string;
      name: string;
      profileIconId: number;
      revisionDate: number;
      summonerLevel: number;
    }>(url, `GET /lol/summoner/v4/summoners/by-puuid/{puuid}`);

    return {
      id: data.id,
      puuid: data.puuid,
      name: data.name,
      profileIconId: data.profileIconId,
      summonerLevel: data.summonerLevel,
      region: this.region,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get summoner information for the authenticated user (requires API key)
   * Uses platform routing: /lol/summoner/v4/summoners/me
   */
  async getSummonerByMe(): Promise<Summoner> {
    const url = `${this.getBaseUrl()}/lol/summoner/v4/summoners/me`;
    const data = await this.fetchRiotApi<{
      id: string;
      accountId: string;
      puuid: string;
      name: string;
      profileIconId: number;
      revisionDate: number;
      summonerLevel: number;
    }>(url, `GET /lol/summoner/v4/summoners/me`);

    return {
      id: data.id,
      puuid: data.puuid,
      name: data.name,
      profileIconId: data.profileIconId,
      summonerLevel: data.summonerLevel,
      region: this.region,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get account information by Riot ID (gameName + tagLine)
   * Uses regional routing (ASIA, AMERICAS, EUROPE)
   */
  async getAccountByRiotId(gameName: string, tagLine: string): Promise<{
    puuid: string;
    gameName: string;
    tagLine: string;
  }> {
    const encodedGameName = encodeURIComponent(gameName);
    const encodedTagLine = encodeURIComponent(tagLine);
    const url = `${this.getRegionalBaseUrl()}/riot/account/v1/accounts/by-riot-id/${encodedGameName}/${encodedTagLine}`;
    const data = await this.fetchRiotApi<{
      puuid: string;
      gameName: string;
      tagLine: string;
    }>(url, `GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}`);

    return data;
  }

  /**
   * Get account information by PUUID
   * Uses regional routing (ASIA, AMERICAS, EUROPE)
   */
  async getAccountByPuuid(puuid: string): Promise<{
    puuid: string;
    gameName: string;
    tagLine: string;
  }> {
    const url = `${this.getRegionalBaseUrl()}/riot/account/v1/accounts/by-puuid/${puuid}`;
    const data = await this.fetchRiotApi<{
      puuid: string;
      gameName: string;
      tagLine: string;
    }>(url, `GET /riot/account/v1/accounts/by-puuid/{puuid}`);

    return data;
  }

  /**
   * Get league entries by PUUID
   * Uses /lol/league/v4/entries/by-puuid/{encryptedPUUID}
   * Note: encryptedPUUID is the puuid itself (NOT summonerId)
   */
  async getLeagueEntriesByPuuid(puuid: string): Promise<LeagueEntry[]> {
    // Use puuid directly as encryptedPUUID (NOT summonerId)
    const url = `${this.getBaseUrl()}/lol/league/v4/entries/by-puuid/${puuid}`;
    logger.debug('[RiotApiClient] getLeagueEntriesByPuuid - puuid (encryptedPUUID):', puuid);
    logger.debug('[RiotApiClient] getLeagueEntriesByPuuid - API URL:', url);
    const data = await this.fetchRiotApi<LeagueEntry[]>(url, `GET /lol/league/v4/entries/by-puuid/{encryptedPUUID}`);
    logger.debug('[RiotApiClient] getLeagueEntriesByPuuid - League entries count:', data.length);
    logger.debug('[RiotApiClient] getLeagueEntriesByPuuid - League entries:', JSON.stringify(data, null, 2));
    return data;
  }

  async getRankedSoloQueueEntryByPuuid(puuid: string): Promise<LeagueEntry | null> {
    const entries = await this.getLeagueEntriesByPuuid(puuid);
    return entries.find(entry => entry.queueType === 'RANKED_SOLO_5x5') || null;
  }

  async getRankedFlexEntryByPuuid(puuid: string): Promise<LeagueEntry | null> {
    const entries = await this.getLeagueEntriesByPuuid(puuid);
    return entries.find(entry => entry.queueType === 'RANKED_FLEX_SR') || null;
  }

  /**
   * Get match IDs by PUUID
   * Uses /lol/match/v5/matches/by-puuid/{puuid}/ids
   * Returns list of match IDs
   */
  async getMatchIdsByPuuid(puuid: string, start?: number, count: number = 20, queue?: number): Promise<string[]> {
    const regionalUrl = this.getRegionalBaseUrl();
    let url = `${regionalUrl}/lol/match/v5/matches/by-puuid/${puuid}/ids?count=${count}`;
    if (start !== undefined) {
      url += `&start=${start}`;
    }
    if (queue !== undefined) {
      url += `&queue=${queue}`;
    }
    logger.debug('[RiotApiClient] getMatchIdsByPuuid - API URL:', url);
    const data = await this.fetchRiotApi<string[]>(url, `GET /lol/match/v5/matches/by-puuid/{puuid}/ids`);
    logger.debug('[RiotApiClient] getMatchIdsByPuuid - Match IDs count:', data.length);
    return data;
  }

  /**
   * Get match details by match ID
   * Uses /lol/match/v5/matches/{matchId}
   */
  async getMatchByMatchId(matchId: string): Promise<any> {
    const regionalUrl = this.getRegionalBaseUrl();
    const url = `${regionalUrl}/lol/match/v5/matches/${matchId}`;
    logger.debug('[RiotApiClient] getMatchByMatchId - API URL:', url);
    const data = await this.fetchRiotApi<any>(url, `GET /lol/match/v5/matches/{matchId}`);
    return data;
  }

  /**
   * Get all ranked match IDs for a player (up to a limit)
   * Queue ID 420 = Ranked Solo/Duo, 440 = Ranked Flex
   */
  async getAllRankedMatchIds(puuid: string, maxMatches: number = 100): Promise<string[]> {
    const allMatchIds: string[] = [];
    let start = 0;
    const count = 100; // Max per request
    const queueId = 420; // Ranked Solo/Duo

    while (allMatchIds.length < maxMatches) {
      try {
        const matchIds = await this.getMatchIdsByPuuid(puuid, start, count, queueId);
        if (matchIds.length === 0) {
          break;
        }
        allMatchIds.push(...matchIds);
        start += count;
        
        if (matchIds.length < count) {
          break; // No more matches
        }
      } catch (error) {
        logger.error('[RiotApiClient] Error fetching match IDs:', error);
        break;
      }
    }

    logger.debug('[RiotApiClient] getAllRankedMatchIds - Total match IDs:', allMatchIds.length);
    return allMatchIds.slice(0, maxMatches);
  }
}

// Utility function to convert tier and rank to LP value for comparison
export function tierRankToLP(tier: string, rank: string, lp: number): number {
  // Defensive check for undefined/null values
  if (!tier || typeof tier !== 'string') {
    return 0;
  }

  const tierValues: Record<string, number> = {
    'IRON': 0,
    'BRONZE': 400,
    'SILVER': 800,
    'GOLD': 1200,
    'PLATINUM': 1600,
    'EMERALD': 2000,
    'DIAMOND': 2400,
    'MASTER': 2800,
    'GRANDMASTER': 2800,
    'CHALLENGER': 2800,
  };

  const rankValues: Record<string, number> = {
    'IV': 0,
    'III': 100,
    'II': 200,
    'I': 300,
  };

  const tierUpper = tier.toUpperCase();
  const baseLP = tierValues[tierUpper] || 0;
  const rankLP = rank && typeof rank === 'string' ? (rankValues[rank.toUpperCase()] || 0) : 0;
  
  // Master, Grandmaster, Challenger don't have ranks
  if (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tierUpper)) {
    return baseLP + (lp || 0);
  }

  return baseLP + rankLP + (lp || 0);
}

export function lpToTierRank(totalLP: number): { tier: string; rank: string; lp: number } {
  const tiers = [
    { name: 'IRON', base: 0, max: 400 },
    { name: 'BRONZE', base: 400, max: 800 },
    { name: 'SILVER', base: 800, max: 1200 },
    { name: 'GOLD', base: 1200, max: 1600 },
    { name: 'PLATINUM', base: 1600, max: 2000 },
    { name: 'EMERALD', base: 2000, max: 2400 },
    { name: 'DIAMOND', base: 2400, max: 2800 },
    { name: 'MASTER', base: 2800, max: Infinity },
  ];

  const ranks = ['IV', 'III', 'II', 'I'];

  for (const tier of tiers) {
    if (totalLP < tier.max) {
      if (tier.name === 'MASTER') {
        return { tier: tier.name, rank: '', lp: totalLP - tier.base };
      }
      const lpInTier = totalLP - tier.base;
      const rankIndex = Math.floor(lpInTier / 100);
      const rank = ranks[Math.min(rankIndex, ranks.length - 1)];
      const lp = lpInTier % 100;
      return { tier: tier.name, rank, lp };
    }
  }

  return { tier: 'MASTER', rank: '', lp: totalLP - 2800 };
}

/**
 * Riot APIのマッチ詳細レスポンスから、指定されたプレイヤーのMatch型データを抽出
 * @param matchData Riot APIのマッチ詳細レスポンス
 * @param puuid 対象プレイヤーのPUUID
 * @param matchId マッチID（必須）
 * @returns Match型のデータ、プレイヤーが見つからない場合はnull
 */
export function parseMatchDetails(matchData: any, puuid: string, matchId: string): Match | null {
  try {
    const info = matchData.info;
    if (!info || !info.participants) {
      logger.error('[parseMatchDetails] Invalid match data structure');
      return null;
    }

    // 対象プレイヤーのデータを取得
    const participant = info.participants.find((p: any) => p.puuid === puuid);
    if (!participant) {
      logger.warn('[parseMatchDetails] Participant not found for puuid:', puuid);
      return null;
    }

    // 試合時間（秒）
    const gameDuration = info.gameDuration || 0;
    const gameDurationMinutes = gameDuration / 60;

    // CS計算
    const totalMinionsKilled = participant.totalMinionsKilled || 0;
    const neutralMinionsKilled = participant.neutralMinionsKilled || 0;
    const totalCS = totalMinionsKilled + neutralMinionsKilled;
    const csPerMin = gameDurationMinutes > 0 ? totalCS / gameDurationMinutes : 0;

    // 10分時点のCS（challengesから取得、なければ概算）
    // challenges.csDiffPerMinDeltasはCS差分なので、正確な10分時点のCSは別の方法で取得する必要がある
    // 暫定的に、平均CSから10分時点を推定（正確な値はtimeline APIが必要）
    const csAt10 = participant.challenges?.csAt10 
      ? participant.challenges.csAt10
      : gameDurationMinutes >= 10 
        ? Math.round((totalMinionsKilled / gameDurationMinutes) * 10)
        : totalMinionsKilled;

    // レーン位置の変換（Riot APIのteamPositionをlaneに変換）
    const teamPosition = participant.teamPosition || '';
    let lane: string | undefined;
    if (teamPosition === 'TOP') lane = 'TOP';
    else if (teamPosition === 'JUNGLE') lane = 'JUNGLE';
    else if (teamPosition === 'MIDDLE') lane = 'MID';
    else if (teamPosition === 'BOTTOM') lane = 'ADC';
    else if (teamPosition === 'UTILITY') lane = 'SUPPORT';

    // 時間帯の判定（gameEndTimestampから）
    const gameEndTimestamp = info.gameEndTimestamp;
    let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | undefined;
    if (gameEndTimestamp) {
      const endDate = new Date(gameEndTimestamp);
      const hour = endDate.getHours();
      if (hour >= 5 && hour < 12) timeOfDay = 'morning';
      else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
      else if (hour >= 17 && hour < 22) timeOfDay = 'evening';
      else timeOfDay = 'night';
    }

    // KDA計算
    const kills = participant.kills || 0;
    const deaths = participant.deaths || 0;
    const assists = participant.assists || 0;
    const kda = { kills, deaths, assists };

    // キル参加率の計算
    const teamKills = info.participants
      .filter((p: any) => p.teamId === participant.teamId)
      .reduce((sum: number, p: any) => sum + (p.kills || 0), 0);
    const killParticipation = teamKills > 0 
      ? ((kills + assists) / teamKills) * 100 
      : undefined;

    const match: Match = {
      matchId: matchId, // Use provided matchId (required)
      date: new Date(gameEndTimestamp || info.gameStartTimestamp || Date.now()),
      win: participant.win || false,
      role: lane, // roleとlaneは同じ値を使用
      champion: participant.championName,
      kda,
      csAt10: csAt10 ? Math.round(csAt10) : undefined,
      visionScore: participant.visionScore,
      killParticipation: killParticipation ? Math.round(killParticipation * 10) / 10 : undefined,
      timeOfDay,
      lane,
      damageDealt: participant.totalDamageDealtToChampions || 0,
      damageTaken: participant.totalDamageTaken || 0,
      damageToChampions: participant.totalDamageDealtToChampions || 0,
      goldEarned: participant.goldEarned || 0,
      csPerMin: Math.round(csPerMin * 10) / 10,
      gameDuration,
      totalMinionsKilled,
      neutralMinionsKilled,
    };

    return match;
  } catch (error) {
    logger.error('[parseMatchDetails] Error parsing match details:', error);
    return null;
  }
}

/**
 * 複数のマッチIDからマッチ詳細を取得し、指定されたプレイヤーのMatch型データに変換
 * @param client RiotApiClientインスタンス
 * @param matchIds マッチIDの配列
 * @param puuid 対象プレイヤーのPUUID
 * @param delayMs 各リクエスト間の遅延（ミリ秒、レート制限対策）
 * @returns Match型のデータの配列
 */
export async function fetchAndParseMatchDetails(
  client: RiotApiClient,
  matchIds: string[],
  puuid: string,
  delayMs: number = 50
): Promise<Match[]> {
  const matches: Match[] = [];

  for (let i = 0; i < matchIds.length; i++) {
    try {
      const matchId = matchIds[i];
      logger.debug(`[fetchAndParseMatchDetails] Fetching match ${i + 1}/${matchIds.length}: ${matchId}`);
      
      const matchData = await client.getMatchByMatchId(matchId);
      const match = parseMatchDetails(matchData, puuid, matchId);
      
      if (match) {
        matches.push(match);
      }

      // レート制限対策: 最後のリクエスト以外は遅延を入れる
      if (i < matchIds.length - 1 && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      logger.error(`[fetchAndParseMatchDetails] Error fetching match ${matchIds[i]}:`, error);
      // エラーが発生しても続行
    }
  }

  return matches;
}

