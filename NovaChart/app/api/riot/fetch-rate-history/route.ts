import { NextRequest, NextResponse } from 'next/server';
import { RiotApiClient, tierRankToLP, lpToTierRank } from '@/lib/riot/client';

/**
 * Fetch rate history from match history
 * This endpoint fetches match history and attempts to calculate rate changes
 * 
 * ⚠️ CRITICAL: This endpoint ONLY returns RANKED_SOLO_5x5 (solo queue) data.
 * This mistake has been made multiple times. DO NOT return any other queue types.
 * 
 * Rules:
 * - Only fetch solo queue league entry using getRankedSoloQueueEntryByPuuid
 * - DO NOT fetch flex queue or any other queue type data
 * - Returned currentEntry is guaranteed to be solo queue
 */
export async function POST(request: NextRequest) {
  const { puuid, region = 'jp1', apiKey: apiKeyFromRequest, maxMatches = 100 } = await request.json();

  if (!puuid) {
    return NextResponse.json(
      { error: 'PUUID is required' },
      { status: 400 }
    );
  }

  // Try to get API key from request first, then environment variable
  const apiKey = apiKeyFromRequest || process.env.RIOT_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return NextResponse.json(
      { error: 'Riot API key is not configured. Please set API key in the app settings or .env.local file.' },
      { status: 500 }
    );
  }

  try {
    const client = new RiotApiClient(apiKey, region);

    // ⚠️ CRITICAL: Get current league entry - ONLY solo queue (RANKED_SOLO_5x5)
    // This mistake has been made multiple times. DO NOT use getLeagueEntriesByPuuid
    // or any method that might return flex queue data.
    // MUST use getRankedSoloQueueEntryByPuuid to ensure only solo queue data.
    const currentEntry = await client.getRankedSoloQueueEntryByPuuid(puuid);
    if (!currentEntry) {
      return NextResponse.json(
        { error: 'No ranked solo queue entry found' },
        { status: 404 }
      );
    }

    // Get match IDs
    const matchIds = await client.getAllRankedMatchIds(puuid, maxMatches);

    // Fetch match details (limited to avoid rate limits)
    const matchesToFetch = Math.min(matchIds.length, 20); // Limit to 20 matches for now
    const matchDetails: Array<{ match: any; matchId: string }> = [];

    for (let i = 0; i < matchesToFetch; i++) {
      try {
        const match = await client.getMatchByMatchId(matchIds[i]);
        const matchId = match.metadata?.matchId || matchIds[i];
        matchDetails.push({ match, matchId });
      } catch (error) {
        console.error(`[Fetch Rate History] Error fetching match ${matchIds[i]}:`, error);
        // Continue with other matches
      }
    }

    // Type definition for rate history entry
    type RateHistoryEntry = {
      matchId: string;
      date: string;
      tier: string;
      rank: string;
      lp: number;
      wins: number;
      losses: number;
    };

    // Average LP changes per match (estimated)
    // Note: Riot API doesn't provide actual LP gains/losses per match,
    // so we use realistic average values based on typical League of Legends LP changes
    // Typical range: 15-25 LP per match, with wins averaging slightly higher than losses
    const AVERAGE_LP_GAIN_PER_WIN = 18;  // Average LP gained per win
    const AVERAGE_LP_LOSS_PER_LOSS = 17; // Average LP lost per loss

    // Helper function to calculate LP change based on match result (working backwards)
    const calculateLPChange = (won: boolean): number => {
      // Win: +LP gained, so before match = current - LP gain
      // Loss: -LP lost, so before match = current + LP loss
      return won ? -AVERAGE_LP_GAIN_PER_WIN : AVERAGE_LP_LOSS_PER_LOSS;
    };

    // Helper function to create rate history entry from LP and stats
    const createRateHistoryEntry = (
      matchId: string,
      date: string,
      totalLP: number,
      wins: number,
      losses: number
    ): RateHistoryEntry => {
      const tierRankLP = lpToTierRank(totalLP);
      return {
        matchId,
        date,
        tier: tierRankLP.tier,
        rank: tierRankLP.rank,
        lp: tierRankLP.lp,
        wins,
        losses,
      };
    };

    // Initialize rate history with current entry (for display purposes only)
    // ⚠️ CRITICAL: This entry has matchId starting with "current-" and should NOT be saved to database
    const rateHistory: RateHistoryEntry[] = [
      createRateHistoryEntry(
        `current-${Date.now()}`,
        new Date().toISOString(),
        tierRankToLP(currentEntry.tier, currentEntry.rank, currentEntry.leaguePoints),
        currentEntry.wins,
        currentEntry.losses
      ),
    ];

    // Sort matches by date in descending order (newest first) for reverse calculation
    const sortedMatchDetails = [...matchDetails].sort((a, b) => {
      const dateA = new Date(a.match.info.gameCreation).getTime();
      const dateB = new Date(b.match.info.gameCreation).getTime();
      return dateB - dateA; // Descending order (newest first)
    });

    // Initialize tracking variables from current entry
    // N (latest match) LP = C (currentEntry) LP
    let estimatedTotalLP = tierRankToLP(currentEntry.tier, currentEntry.rank, currentEntry.leaguePoints);
    let estimatedWins = currentEntry.wins;
    let estimatedLosses = currentEntry.losses;

    // Process matches in reverse chronological order (newest first)
    // We'll work backwards from current LP to estimate past LP
    // N-1 LP = N LP - (N match result: Win = -AVERAGE_LP_GAIN, Loss = +AVERAGE_LP_LOSS)
    for (const { match, matchId } of sortedMatchDetails) {
      // Find the player in the match
      const participant = match.info.participants.find((p: any) => p.puuid === puuid);
      if (!participant) continue;

      if (!matchId) {
        console.warn('[Fetch Rate History] Match ID not found, skipping entry');
        continue;
      }

      const matchDate = new Date(match.info.gameCreation);
      const won = participant.win;

      // Add current match's LP to rate history
      rateHistory.push(
        createRateHistoryEntry(
          matchId,
          matchDate.toISOString(),
          estimatedTotalLP,
          estimatedWins,
          estimatedLosses
        )
      );

      // Calculate LP before this match based on match result
      // N-1 LP = N LP - (N match result: Win = -AVERAGE_LP_GAIN, Loss = +AVERAGE_LP_LOSS)
      const lpChange = calculateLPChange(won);
      estimatedTotalLP += lpChange;
      estimatedTotalLP = Math.max(0, estimatedTotalLP);

      // Update wins/losses (working backwards)
      if (won) {
        estimatedWins--;
      } else {
        estimatedLosses--;
      }
    }

    // Sort by date (oldest first)
    rateHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Prepare current entry for response (display purposes only)
    // ⚠️ CRITICAL: currentEntry is provided for display purposes only (plotting)
    // It should NOT be saved to database as it's not based on match history
    // However, leagueId is included for cases where it needs to be saved
    const currentEntryResponse = {
      leagueId: currentEntry.leagueId || '',
      tier: currentEntry.tier,
      rank: currentEntry.rank,
      lp: currentEntry.leaguePoints,
      wins: currentEntry.wins,
      losses: currentEntry.losses,
      date: new Date().toISOString(),
    };

    return NextResponse.json({
      message: 'Rate history fetched from match history',
      rateHistory,
      currentEntry: currentEntryResponse,
      matchesProcessed: matchDetails.length,
      totalMatches: matchIds.length,
    });
  } catch (error) {
    console.error('[Fetch Rate History] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch rate history' },
      { status: 500 }
    );
  }
}


