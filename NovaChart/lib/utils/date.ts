/**
 * Date utility functions
 * Provides consistent date formatting and manipulation
 */

/**
 * Format date to short format (M/D)
 * Example: 1/15, 12/25
 * 
 * @param date - Date object to format
 * @returns Formatted date string (M/D)
 */
export function formatDateShort(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
}

/**
 * Format date to full format
 * Example: 2024/1/15, 2024/12/25
 * 
 * @param date - Date object to format
 * @returns Formatted date string (YYYY/M/D)
 */
export function formatDateFull(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}/${month}/${day}`;
}

/**
 * Get date key for comparison (YYYY-M-D)
 * Used for grouping dates by day
 * 
 * @param date - Date object
 * @returns Date key string (YYYY-M-D)
 */
export function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  return `${year}-${month}-${day}`;
}

/**
 * Get start of day (00:00:00)
 * 
 * @param date - Date object
 * @returns Date object at start of day
 */
export function getStartOfDay(date: Date): Date {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  return startOfDay;
}

/**
 * Get end of day (23:59:59.999)
 * 
 * @param date - Date object
 * @returns Date object at end of day
 */
export function getEndOfDay(date: Date): Date {
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay;
}

/**
 * Check if two dates are on the same day
 * 
 * @param date1 - First date
 * @param date2 - Second date
 * @returns True if dates are on the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return getDateKey(date1) === getDateKey(date2);
}

