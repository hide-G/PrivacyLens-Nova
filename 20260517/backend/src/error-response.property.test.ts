/**
 * Property 11: エラーレスポンスは内部情報を漏洩しない
 *
 * Feature: privacy-lens-nova, Property 11: エラーレスポンスは内部情報を漏洩しない
 *
 * For any エラー状態（不正入力、レート制限超過、API障害）に対して、
 * エラーレスポンスのボディにスタックトレース、内部ファイルパス、
 * 依存サービス名が含まれない。
 *
 * Validates: Requirements 11.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { handler } from './handler.js';

// face-detector と usage-tracker をモック
vi.mock('./face-detector.js', () => ({
  detectFaces: vi.fn(),
}));

vi.mock('./usage-tracker.js', () => ({
  saveUsageRecord: vi.fn(),
}));

import { detectFaces } from './face-detector.js';
import { saveUsageRecord } from './usage-tracker.js';

const mockedDetectFaces = vi.mocked(detectFaces);
const mockedSaveUsageRecord = vi.mocked(saveUsageRecord);

/** テスト用のLambda Function URLイベントを生成する */
function createEvent(overrides: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
} = {}) {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: '/',
    rawQueryString: '',
    headers: {
      'content-type': 'application/json',
      ...overrides.headers,
    },
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      domainName: 'test.lambda-url.us-east-1.on.aws',
      domainPrefix: 'test',
      http: {
        method: overrides.method || 'POST',
        path: '/',
        protocol: 'HTTP/1.1',
        sourceIp: '192.168.1.1',
        userAgent: 'test-agent',
      },
      requestId: 'test-request-id',
      routeKey: '$default',
      stage: '$default',
      time: '2025-01-01T00:00:00.000Z',
      timeEpoch: 1704067200000,
    },
    body: overrides.body !== undefined ? overrides.body : JSON.stringify({
      image: 'dGVzdC1pbWFnZS1kYXRh',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
    }),
    isBase64Encoded: overrides.isBase64Encoded || false,
  };
}

/**
 * レスポンスボディに内部情報が含まれていないことを検証する
 */
function assertNoInternalInfoLeaked(responseBody: string): void {
  // スタックトレースパターンの検出
  expect(responseBody).not.toMatch(/at\s+\S+\s*\(/); // "at functionName ("
  expect(responseBody).not.toMatch(/at\s+\/[^\s]+/); // "at /path/to/file"
  expect(responseBody).not.toMatch(/at\s+[A-Z]:\\[^\s]+/i); // "at C:\path\to\file" (Windows)
  expect(responseBody).not.toMatch(/Error:\s/); // "Error: " パターン（ただし日本語エラーメッセージは許可）
  expect(responseBody).not.toMatch(/\.js:\d+:\d+/); // "file.js:42:13"
  expect(responseBody).not.toMatch(/\.ts:\d+:\d+/); // "file.ts:42:13"

  // 内部ファイルパスの検出
  expect(responseBody).not.toContain('/var/task');
  expect(responseBody).not.toContain('/opt/');
  expect(responseBody).not.toContain('node_modules');
  expect(responseBody).not.toContain('/tmp/');
  expect(responseBody).not.toContain('/var/runtime');
  expect(responseBody).not.toContain('/var/lang');

  // 依存サービス名の検出
  expect(responseBody).not.toContain('Bedrock');
  expect(responseBody).not.toContain('DynamoDB');
  expect(responseBody).not.toContain('AWS');
  expect(responseBody).not.toContain('InvokeModel');
  expect(responseBody).not.toContain('Lambda');
}

describe('Feature: privacy-lens-nova, Property 11: エラーレスポンスは内部情報を漏洩しない', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSaveUsageRecord.mockResolvedValue(undefined);
  });

  it('任意のエラーメッセージとスタックトレースを持つエラーがスローされても内部情報を漏洩しない', async () => {
    // スタックトレースを含むエラーメッセージのジェネレータ
    const errorMessageArb = fc.oneof(
      fc.string({ minLength: 1, maxLength: 200 }),
      fc.constantFrom(
        'Error: Cannot read property of undefined',
        'TypeError: x is not a function',
        'RangeError: Maximum call stack size exceeded',
        'SyntaxError: Unexpected token',
        'Bedrock InvokeModel failed with status 500',
        'DynamoDB PutItem failed: ConditionalCheckFailedException',
        'AWS SDK error: NetworkingError',
        'ECONNREFUSED 127.0.0.1:8000',
        'Lambda execution timeout after 30000ms',
      )
    );

    const stackTraceArb = fc.oneof(
      fc.constant(undefined),
      fc.constantFrom(
        'Error: test\n    at Object.<anonymous> (/var/task/handler.js:42:13)\n    at Module._compile (node:internal/modules/cjs/loader:1376:14)',
        'TypeError: Cannot read properties\n    at detectFaces (/var/task/face-detector.js:15:20)\n    at /opt/nodejs/node_modules/@aws-sdk/client-bedrock-runtime/dist-cjs/index.js:1:1',
        'Error: timeout\n    at /var/runtime/index.mjs:1:1\n    at /var/lang/lib/node_modules/aws-sdk/lib/request.js:31:9',
        'Error: connect ECONNREFUSED\n    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1595:16)',
      ),
      fc.string({ minLength: 10, maxLength: 500 }).map(s =>
        `Error: ${s}\n    at /var/task/handler.js:${Math.floor(Math.random() * 100)}:${Math.floor(Math.random() * 50)}`
      )
    );

    const statusCodeArb = fc.oneof(
      fc.constant(undefined),
      fc.integer({ min: 400, max: 599 }),
    );

    await fc.assert(
      fc.asyncProperty(
        errorMessageArb,
        stackTraceArb,
        statusCodeArb,
        async (message, stack, statusCode) => {
          // エラーオブジェクトを構築
          const error: Record<string, unknown> = { message };
          if (stack !== undefined) {
            error.stack = stack;
          }
          if (statusCode !== undefined) {
            error.statusCode = statusCode;
          }

          mockedDetectFaces.mockRejectedValue(error);

          const event = createEvent();
          const response = await handler(event);

          // エラーレスポンスであることを確認
          expect(response.statusCode).toBeGreaterThanOrEqual(400);

          // 内部情報が漏洩していないことを検証
          assertNoInternalInfoLeaked(response.body);

          // レスポンスが有効なJSONであることを確認
          const body = JSON.parse(response.body);
          expect(body.success).toBe(false);
          expect(typeof body.error).toBe('string');
          expect(typeof body.code).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('任意の不正なリクエストボディに対してエラーレスポンスが内部情報を漏洩しない', async () => {
    // 不正なリクエストボディのジェネレータ
    const invalidBodyArb = fc.oneof(
      // 不正なJSON文字列
      fc.string({ minLength: 1, maxLength: 500 }).filter(s => {
        try { JSON.parse(s); return false; } catch { return true; }
      }),
      // imageフィールドが欠落
      fc.record({
        sessionId: fc.string({ minLength: 1, maxLength: 50 }),
      }).map(obj => JSON.stringify(obj)),
      // sessionIdフィールドが欠落
      fc.record({
        image: fc.string({ minLength: 1, maxLength: 50 }),
      }).map(obj => JSON.stringify(obj)),
      // 不正な型のフィールド
      fc.record({
        image: fc.oneof(fc.integer(), fc.boolean(), fc.constant(null)),
        sessionId: fc.oneof(fc.integer(), fc.boolean(), fc.constant(null)),
      }).map(obj => JSON.stringify(obj)),
    );

    await fc.assert(
      fc.asyncProperty(invalidBodyArb, async (body) => {
        const event = createEvent({ body });
        const response = await handler(event);

        // バリデーションエラーであることを確認
        expect(response.statusCode).toBe(400);

        // 内部情報が漏洩していないことを検証
        assertNoInternalInfoLeaked(response.body);

        // レスポンスが有効なJSONであることを確認
        const parsed = JSON.parse(response.body);
        expect(parsed.success).toBe(false);
        expect(typeof parsed.error).toBe('string');
        expect(typeof parsed.code).toBe('string');
      }),
      { numRuns: 100 }
    );
  });

  it('任意のHTTPステータスコードを持つエラーに対してレスポンスが内部情報を漏洩しない', async () => {
    const httpStatusArb = fc.integer({ min: 400, max: 599 });
    const serviceErrorMessageArb = fc.oneof(
      fc.constantFrom(
        'Bedrock InvokeModel: ThrottlingException',
        'DynamoDB: ProvisionedThroughputExceededException',
        'AWS Lambda: TooManyRequestsException',
        'ServiceUnavailableException: Service is currently unavailable',
        'AccessDeniedException: User is not authorized to perform bedrock:InvokeModel',
        'ValidationException: The provided model identifier is invalid',
        'ResourceNotFoundException: Model not found in region us-east-1',
      ),
      fc.string({ minLength: 1, maxLength: 300 }),
    );

    await fc.assert(
      fc.asyncProperty(httpStatusArb, serviceErrorMessageArb, async (statusCode, message) => {
        mockedDetectFaces.mockRejectedValue({ statusCode, message });

        const event = createEvent();
        const response = await handler(event);

        // エラーレスポンスであることを確認
        expect(response.statusCode).toBeGreaterThanOrEqual(400);

        // 内部情報が漏洩していないことを検証
        assertNoInternalInfoLeaked(response.body);

        // レスポンスが有効なJSONであることを確認
        const body = JSON.parse(response.body);
        expect(body.success).toBe(false);
        expect(typeof body.error).toBe('string');
        expect(typeof body.code).toBe('string');
      }),
      { numRuns: 100 }
    );
  });

  it('ファイルパスを含むエラーオブジェクトに対してレスポンスが内部情報を漏洩しない', async () => {
    // ファイルパスを含むエラーのジェネレータ
    const filePathArb = fc.oneof(
      fc.constantFrom(
        '/var/task/handler.js',
        '/var/task/face-detector.js',
        '/var/task/node_modules/@aws-sdk/client-bedrock-runtime/dist-cjs/index.js',
        '/opt/nodejs/node20/node_modules/aws-sdk/lib/core.js',
        '/var/runtime/index.mjs',
        '/var/lang/lib/node_modules/npm/lib/cli.js',
        '/tmp/cache/model-response.json',
        'C:\\Users\\dev\\project\\handler.ts',
      )
    );

    const errorWithPathArb = fc.tuple(filePathArb, fc.string({ minLength: 1, maxLength: 100 })).map(
      ([path, msg]) => ({
        message: `Failed at ${path}: ${msg}`,
        stack: `Error: ${msg}\n    at processRequest (${path}:42:13)\n    at async handler (${path}:100:5)`,
        statusCode: undefined,
      })
    );

    await fc.assert(
      fc.asyncProperty(errorWithPathArb, async (error) => {
        mockedDetectFaces.mockRejectedValue(error);

        const event = createEvent();
        const response = await handler(event);

        // エラーレスポンスであることを確認
        expect(response.statusCode).toBeGreaterThanOrEqual(400);

        // 内部情報が漏洩していないことを検証
        assertNoInternalInfoLeaked(response.body);
      }),
      { numRuns: 100 }
    );
  });
});
