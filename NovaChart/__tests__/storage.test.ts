import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageService } from '../lib/utils/storage';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

// Mock window object
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock constants
vi.mock('../lib/constants', () => ({
  STORAGE_KEYS: {
    API_KEY: 'riot_api_key',
    API_REGION: 'riot_api_region',
    RIOT_ID: 'riot_id',
    GAME_NAME: 'riot_game_name',
    TAG_LINE: 'riot_tag_line',
  },
  DEFAULTS: {
    REGION: 'jp1',
  },
}));

describe('StorageService', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('API Key', () => {
    it('gets API key from localStorage', () => {
      localStorageMock.setItem('riot_api_key', 'test-api-key');
      expect(StorageService.getApiKey()).toBe('test-api-key');
    });

    it('returns null when API key is not set', () => {
      expect(StorageService.getApiKey()).toBeNull();
    });

    it('sets API key to localStorage', () => {
      StorageService.setApiKey('test-api-key');
      expect(localStorageMock.getItem('riot_api_key')).toBe('test-api-key');
    });

    it('trims whitespace when setting API key', () => {
      StorageService.setApiKey('  test-api-key  ');
      expect(localStorageMock.getItem('riot_api_key')).toBe('test-api-key');
    });

    it('removes API key from localStorage', () => {
      localStorageMock.setItem('riot_api_key', 'test-api-key');
      StorageService.removeApiKey();
      expect(localStorageMock.getItem('riot_api_key')).toBeNull();
    });
  });

  describe('API Region', () => {
    it('gets API region from localStorage', () => {
      localStorageMock.setItem('riot_api_region', 'na1');
      expect(StorageService.getApiRegion()).toBe('na1');
    });

    it('returns default region when not set', () => {
      expect(StorageService.getApiRegion()).toBe('jp1');
    });

    it('sets API region to localStorage', () => {
      StorageService.setApiRegion('kr');
      expect(localStorageMock.getItem('riot_api_region')).toBe('kr');
    });

    it('removes API region from localStorage', () => {
      localStorageMock.setItem('riot_api_region', 'na1');
      StorageService.removeApiRegion();
      expect(localStorageMock.getItem('riot_api_region')).toBeNull();
    });
  });

  describe('Riot ID', () => {
    it('gets Riot ID from localStorage', () => {
      localStorageMock.setItem('riot_id', 'TestUser#1234');
      expect(StorageService.getRiotId()).toBe('TestUser#1234');
    });

    it('returns null when Riot ID is not set', () => {
      expect(StorageService.getRiotId()).toBeNull();
    });

    it('sets Riot ID to localStorage', () => {
      StorageService.setRiotId('TestUser#1234');
      expect(localStorageMock.getItem('riot_id')).toBe('TestUser#1234');
    });

    it('removes Riot ID from localStorage', () => {
      localStorageMock.setItem('riot_id', 'TestUser#1234');
      StorageService.removeRiotId();
      expect(localStorageMock.getItem('riot_id')).toBeNull();
    });
  });

  describe('Game Name and Tag Line (backward compatibility)', () => {
    it('gets game name from localStorage', () => {
      localStorageMock.setItem('riot_game_name', 'TestUser');
      expect(StorageService.getGameName()).toBe('TestUser');
    });

    it('returns null when game name is not set', () => {
      expect(StorageService.getGameName()).toBeNull();
    });

    it('gets tag line from localStorage', () => {
      localStorageMock.setItem('riot_tag_line', '1234');
      expect(StorageService.getTagLine()).toBe('1234');
    });

    it('returns null when tag line is not set', () => {
      expect(StorageService.getTagLine()).toBeNull();
    });
  });

  describe('clearAll', () => {
    it('removes all storage keys', () => {
      localStorageMock.setItem('riot_api_key', 'test-key');
      localStorageMock.setItem('riot_api_region', 'na1');
      localStorageMock.setItem('riot_id', 'TestUser#1234');

      StorageService.clearAll();

      expect(localStorageMock.getItem('riot_api_key')).toBeNull();
      expect(localStorageMock.getItem('riot_api_region')).toBeNull();
      expect(localStorageMock.getItem('riot_id')).toBeNull();
    });
  });

  describe('migrateOldFormat', () => {
    it('migrates game name and tag line to Riot ID', () => {
      localStorageMock.setItem('riot_game_name', 'TestUser');
      localStorageMock.setItem('riot_tag_line', '1234');

      const result = StorageService.migrateOldFormat();

      expect(result).toBe('TestUser#1234');
      expect(localStorageMock.getItem('riot_id')).toBe('TestUser#1234');
    });

    it('returns null when game name is missing', () => {
      localStorageMock.setItem('riot_tag_line', '1234');

      const result = StorageService.migrateOldFormat();

      expect(result).toBeNull();
      expect(localStorageMock.getItem('riot_id')).toBeNull();
    });

    it('returns null when tag line is missing', () => {
      localStorageMock.setItem('riot_game_name', 'TestUser');

      const result = StorageService.migrateOldFormat();

      expect(result).toBeNull();
      expect(localStorageMock.getItem('riot_id')).toBeNull();
    });

    it('returns null when both are missing', () => {
      const result = StorageService.migrateOldFormat();

      expect(result).toBeNull();
    });
  });
});

