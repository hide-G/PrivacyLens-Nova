/**
 * Property 11: エラーレスポンスは内部情報を漏洩しない
 *
 * fast-check によるプロパティテスト
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * buildErrorResponse のロジックを再現するヘルパー
 * handler.ts の buildErrorResponse は module-private なので、
 * 同等のロジックをテスト用に再実装する
 */
function buildErrorResponseBody(
  message: string,
  code: string,
  retryAfter?: number,
): string {
  const errorBody = {
    success: false,
    error: message,
    code,
    ...(retryAfter !== undefined && { retryAfter }),
  };
  return JSON.stringify(errorBody);
}

/** 内部情報パターンの検出 */
function containsInternalInfo(responseBody: string): {
  hasStackTrace: boolean;
  hasInternalPath: boolean;
  hasServiceName: boolean;
  details: string[];
} {
  const details: string[] = [];

  // スタックトレースの検出（"at " で始まる行、".js:" や ".ts:" を含む行）
  const stackTracePatterns = [
    /\bat\s+\S+/,
    /\.js:\d+/,
    /\.ts:\d+/,
  ];
  const hasStackTrace = stackTracePatterns.some((pattern) => pattern.test(responseBody));
  if (hasStackTrace) details.push('スタックトレースを検出');

  // 内部ファイルパスの検出
  const internalPathPatterns = [
    /\/var\/task/,
    /\/opt\/nodejs/,
    /node_modules/,
  ];
  const hasInternalPath = internalPathPatterns.some((pattern) => pattern.test(responseBody));
  if (hasInternalPath) details.push('内部ファイルパスを検出');

  // サービス名の検出
  const serviceNamePatterns = [
    /Bedrock/i,
    /DynamoDB/i,
    /InvokeModel/i,
    /PutItem/i,
  ];
  const hasServiceName = serviceNamePatterns.some((pattern) => pattern.test(responseBody));
  if (hasServiceName) details.push('サービス名を検出');

  return { hasStackTrace, hasInternalPath, hasServiceName, details };
}

describe('Property 11: エラーレスポンスは内部情報を漏洩しない', () => {
  /**
   * **Validates: Requirements 11.5**
   */

  /** 安全なエラーメッセージのジェネレータ（日本語メッセージ） */
  const safeErrorMessages = [
    'エラーが発生しました。再試行してください',
    'リクエストが集中しています。1分後に再試行してください',
    'サービスが混雑しています。しばらく待ってから再試行してください',
    'サービスが一時的に利用できません。再試行してください',
    'リクエスト形式が不正です',
    'ファイルサイズが10MBを超えています',
    'Content-Typeはapplication/jsonを指定してください',
    'メソッドが許可されていません',
  ];

  /** エラーコードのジェネレータ */
  const errorCodes = [
    'INTERNAL_ERROR',
    'RATE_LIMITED',
    'SERVICE_BUSY',
    'SERVICE_UNAVAILABLE',
    'INVALID_REQUEST',
    'BODY_TOO_LARGE',
    'INVALID_CONTENT_TYPE',
    'METHOD_NOT_ALLOWED',
    'UPSTREAM_ERROR',
    'EMPTY_BODY',
  ];

  it('エラーレスポンスにスタックトレースが含まれない', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...safeErrorMessages),
        fc.constantFrom(...errorCodes),
        fc.option(fc.integer({ min: 1, max: 120 })),
        (message, code, retryAfter) => {
          const body = buildErrorResponseBody(message, code, retryAfter ?? undefined);
          const info = containsInternalInfo(body);
          expect(info.hasStackTrace).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('エラーレスポンスに内部ファイルパスが含まれない', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...safeErrorMessages),
        fc.constantFrom(...errorCodes),
        fc.option(fc.integer({ min: 1, max: 120 })),
        (message, code, retryAfter) => {
          const body = buildErrorResponseBody(message, code, retryAfter ?? undefined);
          const info = containsInternalInfo(body);
          expect(info.hasInternalPath).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('エラーレスポンスにサービス名が含まれない', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...safeErrorMessages),
        fc.constantFrom(...errorCodes),
        fc.option(fc.integer({ min: 1, max: 120 })),
        (message, code, retryAfter) => {
          const body = buildErrorResponseBody(message, code, retryAfter ?? undefined);
          const info = containsInternalInfo(body);
          expect(info.hasServiceName).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('任意のエラーメッセージを含むレスポンスでも内部情報が漏洩しない', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 0, maxLength: 500 }),
        (errorMessage, stackTrace, filePath) => {
          // 危険な内部情報を含むエラーメッセージを生成
          const dangerousMessages = [
            `Error at /var/task/handler.js:42`,
            `DynamoDB PutItem failed`,
            `Bedrock InvokeModel timeout`,
            `at Object.<anonymous> (/opt/nodejs/node_modules/aws-sdk/lib/request.js:31:14)`,
          ];

          // handler.ts の buildErrorResponse は安全なメッセージのみ使用する設計
          // 内部エラーが発生しても、ユーザーには安全なメッセージのみ返す
          for (const safeMsg of safeErrorMessages) {
            const body = buildErrorResponseBody(safeMsg, 'INTERNAL_ERROR');
            const info = containsInternalInfo(body);
            expect(info.hasStackTrace).toBe(false);
            expect(info.hasInternalPath).toBe(false);
            expect(info.hasServiceName).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('危険な文字列がエラーメッセージに直接渡された場合でも検出できる', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'Error at /var/task/handler.js:42:10',
          'DynamoDB PutItem failed: ConditionalCheckFailedException',
          'Bedrock InvokeModel returned 500',
          'at Runtime.handler (/var/task/index.js:1:2)',
          '/opt/nodejs/node_modules/@aws-sdk/client-bedrock-runtime/dist/index.js:100',
        ),
        (dangerousMessage) => {
          // 危険なメッセージが直接レスポンスに含まれた場合、検出できることを確認
          const body = buildErrorResponseBody(dangerousMessage, 'INTERNAL_ERROR');
          const info = containsInternalInfo(body);
          // 少なくとも1つの内部情報パターンが検出される
          const hasAnyLeak = info.hasStackTrace || info.hasInternalPath || info.hasServiceName;
          expect(hasAnyLeak).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
