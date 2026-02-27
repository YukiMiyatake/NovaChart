import { describe, it, expect } from 'vitest';
import { handleRiotApiError, extractStatusCodeFromError } from '../lib/utils/errorHandler';

describe('handleRiotApiError', () => {
  it('returns 403 message when status is 403', () => {
    const error = new Error('403 Forbidden');
    (error as any).statusCode = 403;
    const message = handleRiotApiError(error, '/api/test');
    expect(message).toContain('APIキーが無効または権限がありません');
  });

  it('returns 404 message when status is 404', () => {
    const error = new Error('404 Not Found');
    (error as any).statusCode = 404;
    const message = handleRiotApiError(error, '/api/test');
    expect(message).toContain('サマナーが見つかりませんでした');
  });

  it('falls back to default message for unknown status', () => {
    const error = new Error('Unexpected error');
    const message = handleRiotApiError(error, '/api/test');
    expect(message).toContain('データの取得に失敗しました');
  });
});

describe('extractStatusCodeFromError', () => {
  it('extracts 429 when message includes Too Many Requests', () => {
    const error = new Error('429 Too Many Requests');
    const status = extractStatusCodeFromError(error);
    expect(status).toBe(429);
  });

  it('defaults to 500 when no code is found', () => {
    const error = new Error('Something else');
    const status = extractStatusCodeFromError(error);
    expect(status).toBe(500);
  });
});

