import { describe, it, expect } from 'vitest';
import {
  handleRiotApiError,
  extractStatusCodeFromError,
  isRiotApiError,
} from '../lib/utils/errorHandler';

describe('handleRiotApiError', () => {
  it('returns 403 message when message contains 403', () => {
    const error = new Error('403 Forbidden');
    const message = handleRiotApiError(error, '/api/test');
    expect(message).toContain('APIキーが無効または権限がありません');
  });

  it('returns 401 message when message contains 401', () => {
    const error = new Error('401 Unauthorized');
    const message = handleRiotApiError(error);
    expect(message).toContain('APIキーが設定されていません');
  });

  it('returns 404 message when message contains 404', () => {
    const error = new Error('404 Not Found');
    const message = handleRiotApiError(error, '/api/test');
    expect(message).toContain('サマナーが見つかりませんでした');
  });

  it('returns 429 message when message contains Too Many Requests', () => {
    const error = new Error('429 Too Many Requests');
    const message = handleRiotApiError(error);
    expect(message).toContain('レート制限');
  });

  it('falls back to default message for unknown status', () => {
    const error = new Error('Unexpected error');
    const message = handleRiotApiError(error, '/api/test');
    expect(message).toContain('データの取得に失敗しました');
  });

  it('returns generic message when not an Error instance', () => {
    const message = handleRiotApiError('string error');
    expect(message).toContain('予期しないエラー');
  });
});

describe('extractStatusCodeFromError', () => {
  it('extracts 403 when message includes 403 or Forbidden', () => {
    expect(extractStatusCodeFromError(new Error('403 Forbidden'))).toBe(403);
  });
  it('extracts 401 when message includes 401 or Unauthorized', () => {
    expect(extractStatusCodeFromError(new Error('401 Unauthorized'))).toBe(401);
  });
  it('extracts 404 when message includes 404 or Not Found', () => {
    expect(extractStatusCodeFromError(new Error('404 Not Found'))).toBe(404);
  });
  it('extracts 429 when message includes Too Many Requests', () => {
    const error = new Error('429 Too Many Requests');
    expect(extractStatusCodeFromError(error)).toBe(429);
  });
  it('defaults to 500 when no code is found', () => {
    expect(extractStatusCodeFromError(new Error('Something else'))).toBe(500);
  });
  it('returns 500 for non-Error value', () => {
    expect(extractStatusCodeFromError(null)).toBe(500);
  });
});

describe('isRiotApiError', () => {
  it('returns true for error message containing 403', () => {
    expect(isRiotApiError(new Error('403 Forbidden'))).toBe(true);
  });
  it('returns true for error message containing riot api', () => {
    expect(isRiotApiError(new Error('Riot API error'))).toBe(true);
  });
  it('returns true for error message containing Too Many Requests', () => {
    expect(isRiotApiError(new Error('429 Too Many Requests'))).toBe(true);
  });
  it('returns false for generic error', () => {
    expect(isRiotApiError(new Error('Network error'))).toBe(false);
  });
  it('returns false for non-Error value', () => {
    expect(isRiotApiError(null)).toBe(false);
  });
});

