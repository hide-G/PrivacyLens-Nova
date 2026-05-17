/**
 * ApiClient ユニットテスト
 *
 * fetch APIをモックして以下を検証:
 * - 正常な顔検出リクエスト
 * - 10秒タイムアウト処理
 * - ネットワークエラー検出 (navigator.onLine + fetch TypeError)
 * - レート制限 (429) ハンドリング
 * - 再試行ロジック
 * - セッションID生成
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient } from './api-client';
import type { DetectFacesResult } from './api-client';

describe('ApiClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let client: ApiClient;
  const BASE_URL = 'https://example.lambda-url.us-east-1.on.aws';

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    // navigator.onLine をデフォルトで true に設定
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true },
      writable: true,
      configurable: true,
    });

    // crypto.randomUUID のモック
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        randomUUID: vi.fn().mockReturnValue('550e8400-e29b-41d4-a716-446655440000'),
      },
      writable: true,
      configurable: true,
    });

    client = new ApiClient(BASE_URL);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('コンストラクタ', () => {
    it('セッションIDが crypto.randomUUID() で生成される', () => {
      expect(client.getSessionId()).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('セッションIDはインスタンスごとに固定される', () => {
      const id1 = client.getSessionId();
      const id2 = client.getSessionId();
      expect(id1).toBe(id2);
    });
  });

  describe('detectFaces', () => {
    it('正常なレスポンスを返す', async () => {
      const mockResponse = {
        success: true,
        faces: [
          { x1: 120, y1: 80, x2: 350, y2: 420 },
          { x1: 600, y1: 100, x2: 820, y2: 450 },
        ],
        faceCount: 2,
        processingTime: 1850,
      };

      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.detectFaces('base64ImageData');

      expect(result.success).toBe(true);
      expect(result.faces).toHaveLength(2);
      expect(result.faceCount).toBe(2);
      expect(result.processingTime).toBe(1850);
    });

    it('正しいURLとヘッダーでリクエストを送信する', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, faces: [], faceCount: 0 }),
      });

      await client.detectFaces('testImage');

      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE_URL}/detect-faces`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: 'testImage',
            sessionId: '550e8400-e29b-41d4-a716-446655440000',
          }),
        })
      );
    });

    it('リクエストにAbortControllerのsignalが含まれる', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, faces: [], faceCount: 0 }),
      });

      await client.detectFaces('testImage');

      const callArgs = fetchMock.mock.calls[0][1];
      expect(callArgs.signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe('タイムアウト処理', () => {
    it('10秒後にタイムアウトエラーを返す', async () => {
      vi.useFakeTimers();

      // fetch が永遠に解決しないPromiseを返す
      fetchMock.mockImplementation((_url: string, options: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      });

      const resultPromise = client.detectFaces('testImage');

      // 10秒進める
      vi.advanceTimersByTime(10000);

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('処理がタイムアウトしました。再試行してください');
    });
  });

  describe('ネットワークエラー検出', () => {
    it('navigator.onLine が false の場合、ネットワークエラーを返す', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: false },
        writable: true,
        configurable: true,
      });

      const result = await client.detectFaces('testImage');

      expect(result.success).toBe(false);
      expect(result.error).toBe('ネットワーク接続を確認してください');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('fetch が TypeError をスローした場合、ネットワークエラーを返す', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      const result = await client.detectFaces('testImage');

      expect(result.success).toBe(false);
      expect(result.error).toBe('ネットワーク接続を確認してください');
    });
  });

  describe('レート制限 (429)', () => {
    it('429レスポンスでレート制限メッセージを返す', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({
          success: false,
          error: 'Rate limited',
          code: 'RATE_LIMITED',
          retryAfter: 30,
        }),
      });

      const result = await client.detectFaces('testImage');

      expect(result.success).toBe(false);
      expect(result.error).toBe('リクエストが集中しています。30秒後に再試行してください');
      expect(result.retryAfter).toBe(30);
    });

    it('retryAfter が未指定の場合、デフォルト60秒を使用する', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({
          success: false,
          code: 'RATE_LIMITED',
        }),
      });

      const result = await client.detectFaces('testImage');

      expect(result.error).toBe('リクエストが集中しています。60秒後に再試行してください');
      expect(result.retryAfter).toBe(60);
    });
  });

  describe('その他のエラーレスポンス', () => {
    it('サーバーエラーメッセージをパススルーする', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          success: false,
          error: 'サービスが一時的に利用できません。再試行してください',
          code: 'INTERNAL_ERROR',
        }),
      });

      const result = await client.detectFaces('testImage');

      expect(result.success).toBe(false);
      expect(result.error).toBe('サービスが一時的に利用できません。再試行してください');
      expect(result.code).toBe('INTERNAL_ERROR');
    });

    it('エラーメッセージが無い場合、デフォルトメッセージを返す', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.resolve({ success: false }),
      });

      const result = await client.detectFaces('testImage');

      expect(result.success).toBe(false);
      expect(result.error).toBe('エラーが発生しました。再試行してください');
    });
  });

  describe('再試行ロジック', () => {
    it('retry() が直前のリクエストを再送信する', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, faces: [], faceCount: 0 }),
      });

      // 最初のリクエスト
      await client.detectFaces('originalImage');

      // 再試行
      await client.retry();

      // 2回目のリクエストも同じ画像データで送信される
      const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(secondCallBody.image).toBe('originalImage');
      expect(secondCallBody.sessionId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('detectFaces 未呼び出し時に retry() がエラーを返す', async () => {
      const result = await client.retry();

      expect(result.success).toBe(false);
      expect(result.error).toBe('エラーが発生しました。再試行してください');
    });

    it('retry() は最新の画像データを使用する', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, faces: [], faceCount: 0 }),
      });

      await client.detectFaces('firstImage');
      await client.detectFaces('secondImage');
      await client.retry();

      const thirdCallBody = JSON.parse(fetchMock.mock.calls[2][1].body);
      expect(thirdCallBody.image).toBe('secondImage');
    });
  });

  describe('予期しないエラー', () => {
    it('不明なエラーの場合、汎用エラーメッセージを返す', async () => {
      fetchMock.mockRejectedValue(new Error('Unknown error'));

      const result = await client.detectFaces('testImage');

      expect(result.success).toBe(false);
      expect(result.error).toBe('エラーが発生しました。再試行してください');
    });
  });
});
