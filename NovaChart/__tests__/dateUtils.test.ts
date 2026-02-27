import { describe, it, expect } from 'vitest';
import { formatDateShort, formatDateFull, getDateKey, isSameDay, getStartOfDay, getEndOfDay } from '../lib/utils/date';

describe('date utils', () => {
  it('formats short date', () => {
    const d = new Date(2024, 4, 10, 12, 0, 0); // May 10, 2024 (month is 0-indexed)
    expect(formatDateShort(d)).toBe('5/10');
  });

  it('formats full date', () => {
    const d = new Date(2024, 4, 10, 12, 0, 0); // May 10, 2024 (month is 0-indexed)
    expect(formatDateFull(d)).toBe('2024/5/10');
  });

  it('creates date key and compares same day', () => {
    // Use local timezone dates to avoid timezone conversion issues
    const d1 = new Date(2024, 4, 10, 3, 0, 0); // May 10, 2024 03:00:00 (month is 0-indexed)
    const d2 = new Date(2024, 4, 10, 22, 0, 0); // May 10, 2024 22:00:00
    expect(getDateKey(d1)).toBe(getDateKey(d2));
    expect(isSameDay(d1, d2)).toBe(true);
  });

  it('returns start and end of day', () => {
    const d = new Date(2024, 4, 10, 12, 34, 56); // May 10, 2024 12:34:56 (month is 0-indexed)
    const start = getStartOfDay(d);
    const end = getEndOfDay(d);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });
});

