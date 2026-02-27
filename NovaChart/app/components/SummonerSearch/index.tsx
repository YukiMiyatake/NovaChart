'use client';

import { useState, useEffect } from 'react';
import { DEFAULTS } from '@/lib/constants';
import { StorageService } from '@/lib/utils/storage';
import { useSummonerSearch } from './useSummonerSearch';
import SearchForm from './SearchForm';

interface SummonerSearchProps {
  isExpanded?: boolean;
  setIsExpanded?: (expanded: boolean) => void;
  onSearchSuccess?: () => void;
}

export default function SummonerSearch({ 
  isExpanded: isExpandedProp, 
  setIsExpanded: setIsExpandedProp,
  onSearchSuccess 
}: SummonerSearchProps = {}) {
  const [riotId, setRiotId] = useState('');
  const [region, setRegion] = useState<string>(DEFAULTS.REGION);
  const [internalExpanded, setInternalExpanded] = useState(true);
  
  // Use prop if provided, otherwise use internal state
  const isExpanded = isExpandedProp !== undefined ? isExpandedProp : internalExpanded;
  const setIsExpanded = setIsExpandedProp || setInternalExpanded;

  const { isSearching, search } = useSummonerSearch(() => {
    // Close the search form after successful search
    setIsExpanded(false);
    if (onSearchSuccess) {
      onSearchSuccess();
    }
  });

  useEffect(() => {
    // Load saved values from localStorage
    const savedRegion = StorageService.getApiRegion();
    const savedRiotId = StorageService.getRiotId();
    
    if (savedRegion) {
      setRegion(savedRegion);
    }
    
    if (savedRiotId) {
      setRiotId(savedRiotId);
    } else {
      // For backward compatibility, try to migrate from old format
      const migratedRiotId = StorageService.migrateOldFormat();
      if (migratedRiotId) {
        setRiotId(migratedRiotId);
      }
    }
  }, []);

  // Save riotId to localStorage when it changes
  useEffect(() => {
    if (riotId.trim()) {
      StorageService.setRiotId(riotId);
    }
  }, [riotId]);

  useEffect(() => {
    if (region) {
      StorageService.setApiRegion(region);
    }
  }, [region]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await search(riotId, region);
    } catch (error) {
      // Error is already handled in useSummonerSearch and set in store
      // Show alert to user
      const errorMessage = error instanceof Error ? error.message : '検索に失敗しました';
      alert(errorMessage);
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow ${isExpanded ? 'p-4' : 'p-2'}`}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center gap-1"
        >
          <span>{isExpanded ? '▼' : '▶'}</span>
          <span>サマナー検索</span>
        </button>
      </div>
      
      {isExpanded && (
        <SearchForm
          riotId={riotId}
          region={region}
          isSearching={isSearching}
          onRiotIdChange={setRiotId}
          onRegionChange={setRegion}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

