/**
 * Error handling utilities
 * Provides unified error handling for Riot API errors and other application errors
 */

export interface RiotApiErrorInfo {
  statusCode: number;
  message: string;
  endpoint?: string;
  originalError?: unknown;
}

/**
 * Check if error is a Riot API error
 */
export function isRiotApiError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('riot api') ||
      message.includes('403') ||
      message.includes('401') ||
      message.includes('404') ||
      message.includes('429') ||
      message.includes('forbidden') ||
      message.includes('unauthorized') ||
      message.includes('not found') ||
      message.includes('too many requests')
    );
  }
  return false;
}

/**
 * Extract status code from error message
 */
export function extractStatusCodeFromError(error: unknown): number {
  if (error instanceof Error) {
    const message = error.message;
    
    if (message.includes('403') || message.includes('Forbidden')) {
      return 403;
    } else if (message.includes('401') || message.includes('Unauthorized')) {
      return 401;
    } else if (message.includes('404') || message.includes('Not Found')) {
      return 404;
    } else if (message.includes('429') || message.includes('Too Many Requests')) {
      return 429;
    }
  }
  
  return 500;
}

/**
 * Handle Riot API error and convert to user-friendly message
 */
export function handleRiotApiError(error: unknown, endpoint?: string): string {
  if (!(error instanceof Error)) {
    return '予期しないエラーが発生しました';
  }

  const message = error.message;
  const statusCode = extractStatusCodeFromError(error);

  // Extract endpoint info if available
  const endpointInfo = endpoint || (message.includes('エラー発生API:') 
    ? message.split('エラー発生API:')[1]?.split('\n')[0]?.trim() 
    : undefined);

  switch (statusCode) {
    case 403:
      return endpointInfo
        ? `APIキーが無効または権限がありません。\nエラー発生API: ${endpointInfo}\nアプリ内の「APIキー設定」で正しいAPIキーを設定してください。開発用APIキーは24時間で期限切れになります。`
        : 'APIキーが無効または権限がありません。右上の「APIキー設定」で正しいAPIキーを設定してください。開発用APIキーは24時間で期限切れになります。';
    
    case 401:
      return 'APIキーが設定されていません。右上の「APIキー設定」からAPIキーを入力してください。';
    
    case 404:
      return 'サマナーが見つかりませんでした。入力内容とリージョンを確認してください。';
    
    case 429:
      return 'APIレート制限に達しました。しばらく待ってから再試行してください。';
    
    default:
      // Check for specific error messages
      if (message.includes('not configured') || message.includes('API key is not configured')) {
        return 'APIキーが設定されていません。右上の「APIキー設定」からAPIキーを入力してください。';
      }
      
      // Return original message if it's already user-friendly
      if (message.includes('APIキー') || message.includes('サマナー') || message.includes('レート制限')) {
        return message;
      }
      
      // Default error message
      return 'データの取得に失敗しました。しばらく待ってから再試行してください。';
  }
}

/**
 * Get HTTP status code for error response
 */
export function getErrorStatusCode(error: unknown): number {
  return extractStatusCodeFromError(error);
}

/**
 * Parse error to get structured error info
 */
export function parseRiotApiError(error: unknown, endpoint?: string): RiotApiErrorInfo {
  const statusCode = extractStatusCodeFromError(error);
  const message = handleRiotApiError(error, endpoint);
  
  return {
    statusCode,
    message,
    endpoint,
    originalError: error,
  };
}

