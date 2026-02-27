import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSummonerSearch } from '../app/components/SummonerSearch/useSummonerSearch';

// Mock useAppStore
const setCurrentSummoner = vi.fn();
const setCurrentLeagueEntry = vi.fn();
const setLoading = vi.fn();
const setError = vi.fn();
const addRateHistory = vi.fn();
const addMatch = vi.fn();
const loadMatches = vi.fn();
const loadRateHistory = vi.fn();
vi.mock('../lib/store/useAppStore', () => ({
  useAppStore: Object.assign(
    () => ({
      setCurrentSummoner,
      setCurrentLeagueEntry,
      setLoading,
      setError,
    }),
    {
      getState: () => ({
        setCurrentSummoner,
        setCurrentLeagueEntry,
        addRateHistory,
        addMatch,
        loadMatches,
        loadRateHistory,
        rateHistory: [],
        matches: [],
        currentLeagueEntry: null,
      }),
    }
  ),
}));

// Mock StorageService
vi.mock('../lib/utils/storage', () => ({
  StorageService: {
    getApiKey: vi.fn(() => 'test-api-key'),
    getApiRegion: vi.fn(() => 'jp1'),
  },
}));

// Mock logger
vi.mock('../lib/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const leagueEntryServiceDelete = vi.fn();
const leagueEntryServiceAddOrUpdate = vi.fn();
const summonerServiceAddOrUpdate = vi.fn();

vi.mock('../lib/db', () => ({
  leagueEntryService: {
    delete: leagueEntryServiceDelete,
    addOrUpdate: leagueEntryServiceAddOrUpdate,
    getByPuuid: vi.fn(),
  },
  summonerService: {
    addOrUpdate: summonerServiceAddOrUpdate,
  },
  rateHistoryService: { getAll: vi.fn(() => Promise.resolve([])) },
  matchService: { getAll: vi.fn(() => Promise.resolve([])) },
}));

// RiotApiClient used in fetchAndSaveMatchDetails
vi.mock('../lib/riot/client', () => ({
  RiotApiClient: vi.fn().mockImplementation(() => ({
    getAllRankedMatchIds: vi.fn(() => Promise.resolve([])),
  })),
}));

describe('League entry: do not delete on no rank / non-solo (history preserved)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT call leagueEntryService.delete when league API returns no entry (rank none)', async () => {
    const mockSummoner = {
      puuid: 'test-puuid-123',
      name: 'TestPlayer',
      profileIconId: 1,
      summonerLevel: 100,
      region: 'jp1',
      lastUpdated: new Date().toISOString(),
    };

    global.fetch = vi.fn()
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ summoner: mockSummoner }),
        } as Response)
      )
      .mockImplementationOnce((url: string) => {
        if (url.includes('league-by-puuid')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ entry: null }),
          } as Response);
        }
        return Promise.resolve({ ok: false } as Response);
      })
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ rateHistory: [] }),
        } as Response)
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ matches: [] }),
        } as Response)
      );

    const { result } = renderHook(() => useSummonerSearch());
    await act(async () => {
      await result.current.search('TestPlayer#JP1', 'jp1');
    });

    await waitFor(() => {
      expect(setCurrentLeagueEntry).toHaveBeenCalledWith(null);
    });
    expect(leagueEntryServiceDelete).not.toHaveBeenCalled();
  });

  it('does NOT call leagueEntryService.delete when league API returns non-solo (flex) entry', async () => {
    const mockSummoner = {
      puuid: 'test-puuid-456',
      name: 'FlexPlayer',
      profileIconId: 2,
      summonerLevel: 50,
      region: 'jp1',
      lastUpdated: new Date().toISOString(),
    };

    const flexEntry = {
      leagueId: 'flex-league-id',
      queueType: 'RANKED_FLEX_SR',
      tier: 'GOLD',
      rank: 'IV',
      leaguePoints: 75,
      wins: 10,
      losses: 8,
    };

    global.fetch = vi.fn()
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ summoner: mockSummoner }),
        } as Response)
      )
      .mockImplementationOnce((url: string) => {
        if (url.includes('league-by-puuid')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ entry: flexEntry }),
          } as Response);
        }
        return Promise.resolve({ ok: false } as Response);
      })
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ rateHistory: [] }),
        } as Response)
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ matches: [] }),
        } as Response)
      );

    const { result } = renderHook(() => useSummonerSearch());
    await act(async () => {
      await result.current.search('FlexPlayer#JP1', 'jp1');
    });

    await waitFor(() => {
      expect(setCurrentLeagueEntry).toHaveBeenCalledWith(null);
    });
    expect(leagueEntryServiceDelete).not.toHaveBeenCalled();
  });

  it('calls leagueEntryService.addOrUpdate and does NOT call delete when league API returns solo entry', async () => {
    const mockSummoner = {
      puuid: 'test-puuid-789',
      name: 'SoloPlayer',
      profileIconId: 3,
      summonerLevel: 80,
      region: 'jp1',
      lastUpdated: new Date().toISOString(),
    };

    const soloEntry = {
      leagueId: 'solo-league-id',
      queueType: 'RANKED_SOLO_5x5',
      tier: 'GOLD',
      rank: 'II',
      leaguePoints: 50,
      wins: 20,
      losses: 15,
    };

    global.fetch = vi.fn()
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ summoner: mockSummoner }),
        } as Response)
      )
      .mockImplementationOnce((url: string) => {
        if (url.includes('league-by-puuid')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ entry: soloEntry }),
          } as Response);
        }
        return Promise.resolve({ ok: false } as Response);
      })
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ rateHistory: [] }),
        } as Response)
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ matches: [] }),
        } as Response)
      );

    const { result } = renderHook(() => useSummonerSearch());
    await act(async () => {
      await result.current.search('SoloPlayer#JP1', 'jp1');
    });

    await waitFor(() => {
      expect(leagueEntryServiceAddOrUpdate).toHaveBeenCalled();
    });
    expect(leagueEntryServiceDelete).not.toHaveBeenCalled();
  });
});
