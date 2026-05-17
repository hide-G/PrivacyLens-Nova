/**
 * PrivacyLens Nova - Lambda Function URL ハンドラーのユニットテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('Lambda Function URL ハンドラー', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedDetectFaces.mockResolvedValue([
      { x1: 120, y1: 80, x2: 350, y2: 420 },
    ]);
    mockedSaveUsageRecord.mockResolvedValue(undefined);
  });

  describe('CORS preflight (OPTIONS)', () => {
    it('OPTIONSリクエストに204を返す', async () => {
      const event = createEvent({ method: 'OPTIONS' });
      const response = await handler(event);

      expect(response.statusCode).toBe(204);
      expect(response.headers['Access-Control-Allow-Origin']).toBe('https://privacylens-nova.com');
      expect(response.headers['Access-Control-Allow-Methods']).toBe('POST, OPTIONS');
      expect(response.headers['Access-Control-Allow-Headers']).toBe('Content-Type');
    });
  });

  describe('メソッド検証', () => {
    it('GETリクエストに405を返す', async () => {
      const event = createEvent({ method: 'GET' });
      const response = await handler(event);

      expect(response.statusCode).toBe(405);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('METHOD_NOT_ALLOWED');
    });
  });

  describe('Content-Type検証', () => {
    it('Content-Typeがapplication/json以外の場合400を返す', async () => {
      const event = createEvent({
        headers: { 'content-type': 'text/plain' },
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('INVALID_CONTENT_TYPE');
    });
  });

  describe('ボディバリデーション', () => {
    it('ボディが空の場合400を返す', async () => {
      const event = createEvent({ body: '' });
      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('EMPTY_BODY');
    });

    it('不正なJSONの場合400を返す', async () => {
      const event = createEvent({ body: 'not-json' });
      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('INVALID_REQUEST');
    });

    it('imageが欠落している場合400を返す', async () => {
      const event = createEvent({
        body: JSON.stringify({ sessionId: 'test-session' }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('INVALID_REQUEST');
    });

    it('sessionIdが欠落している場合400を返す', async () => {
      const event = createEvent({
        body: JSON.stringify({ image: 'base64data' }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('INVALID_REQUEST');
    });

    it('ボディサイズが10MBを超える場合400を返す', async () => {
      // 10MB超のボディを生成
      const largeImage = 'x'.repeat(11 * 1024 * 1024);
      const event = createEvent({
        body: JSON.stringify({ image: largeImage, sessionId: 'test' }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('BODY_TOO_LARGE');
    });
  });

  describe('正常系', () => {
    it('顔検出成功時に200と顔座標を返す', async () => {
      const faces = [
        { x1: 120, y1: 80, x2: 350, y2: 420 },
        { x1: 600, y1: 100, x2: 820, y2: 450 },
      ];
      mockedDetectFaces.mockResolvedValue(faces);

      const event = createEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.faces).toEqual(faces);
      expect(body.faceCount).toBe(2);
      expect(body.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('レスポンスヘッダーにCache-Control: no-storeが設定される', async () => {
      const event = createEvent();
      const response = await handler(event);

      expect(response.headers['Cache-Control']).toBe('no-store');
    });

    it('レスポンスヘッダーにCORSが設定される', async () => {
      const event = createEvent();
      const response = await handler(event);

      expect(response.headers['Access-Control-Allow-Origin']).toBe('https://privacylens-nova.com');
    });

    it('利用統計が非同期で保存される', async () => {
      const event = createEvent();
      await handler(event);

      expect(mockedSaveUsageRecord).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        1,
      );
    });

    it('利用統計の保存失敗が顔検出結果に影響しない', async () => {
      mockedSaveUsageRecord.mockRejectedValue(new Error('DynamoDB error'));

      const event = createEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('エラーハンドリング', () => {
    it('Bedrock API 429エラー時に503を返す', async () => {
      mockedDetectFaces.mockRejectedValue({ statusCode: 429, message: 'Throttled' });

      const event = createEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('SERVICE_BUSY');
    });

    it('Bedrock API 4xxエラー時に502を返す', async () => {
      mockedDetectFaces.mockRejectedValue({ statusCode: 400, message: 'Bad request' });

      const event = createEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(502);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('UPSTREAM_ERROR');
    });

    it('Bedrock API 5xxエラー時に503を返す', async () => {
      mockedDetectFaces.mockRejectedValue({ statusCode: 500, message: 'Internal error' });

      const event = createEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('予期しないエラー時に500を返す', async () => {
      mockedDetectFaces.mockRejectedValue(new Error('unexpected'));

      const event = createEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('INTERNAL_ERROR');
    });

    it('エラーレスポンスにスタックトレースを含めない', async () => {
      const error = new Error('something went wrong');
      error.stack = 'Error: something went wrong\n    at /var/task/handler.js:42:13';
      mockedDetectFaces.mockRejectedValue(error);

      const event = createEvent();
      const response = await handler(event);

      expect(response.body).not.toContain('/var/task');
      expect(response.body).not.toContain('handler.js');
      expect(response.body).not.toContain('at ');
    });

    it('エラーレスポンスに内部サービス名を含めない', async () => {
      mockedDetectFaces.mockRejectedValue({ statusCode: 500, message: 'Bedrock InvokeModel failed' });

      const event = createEvent();
      const response = await handler(event);

      expect(response.body).not.toContain('Bedrock');
      expect(response.body).not.toContain('InvokeModel');
      expect(response.body).not.toContain('DynamoDB');
    });
  });

  describe('Base64エンコードされたボディ', () => {
    it('Base64エンコードされたボディを正しくデコードする', async () => {
      const bodyContent = JSON.stringify({
        image: 'dGVzdC1pbWFnZS1kYXRh',
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
      });
      const base64Body = Buffer.from(bodyContent).toString('base64');

      const event = createEvent({
        body: base64Body,
        isBase64Encoded: true,
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
    });
  });
});
