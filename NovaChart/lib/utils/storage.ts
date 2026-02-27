import { STORAGE_KEYS, DEFAULTS } from '@/lib/constants';

/**
 * StorageService - Unified localStorage management
 * Provides type-safe interface for localStorage operations
 */
export class StorageService {
  /**
   * Get API key from localStorage
   */
  static getApiKey(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.API_KEY);
  }

  /**
   * Set API key to localStorage
   */
  static setApiKey(apiKey: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey.trim());
  }

  /**
   * Remove API key from localStorage
   */
  static removeApiKey(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.API_KEY);
  }

  /**
   * Get API region from localStorage
   */
  static getApiRegion(): string {
    if (typeof window === 'undefined') return DEFAULTS.REGION;
    return localStorage.getItem(STORAGE_KEYS.API_REGION) || DEFAULTS.REGION;
  }

  /**
   * Set API region to localStorage
   */
  static setApiRegion(region: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.API_REGION, region);
  }

  /**
   * Remove API region from localStorage
   */
  static removeApiRegion(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.API_REGION);
  }

  /**
   * Get Riot ID from localStorage
   */
  static getRiotId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.RIOT_ID);
  }

  /**
   * Set Riot ID to localStorage
   */
  static setRiotId(riotId: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.RIOT_ID, riotId);
  }

  /**
   * Remove Riot ID from localStorage
   */
  static removeRiotId(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.RIOT_ID);
  }

  /**
   * Get game name from localStorage (for backward compatibility)
   */
  static getGameName(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.GAME_NAME);
  }

  /**
   * Get tag line from localStorage (for backward compatibility)
   */
  static getTagLine(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.TAG_LINE);
  }

  /**
   * Clear all storage keys
   */
  static clearAll(): void {
    if (typeof window === 'undefined') return;
    this.removeApiKey();
    this.removeApiRegion();
    this.removeRiotId();
  }

  /**
   * Migrate old format (gameName + tagLine) to new format (riotId)
   * Returns the Riot ID if migration was successful, null otherwise
   */
  static migrateOldFormat(): string | null {
    if (typeof window === 'undefined') return null;
    
    const gameName = this.getGameName();
    const tagLine = this.getTagLine();
    
    if (gameName && tagLine) {
      const riotId = `${gameName}#${tagLine}`;
      this.setRiotId(riotId);
      return riotId;
    }
    
    return null;
  }
}

