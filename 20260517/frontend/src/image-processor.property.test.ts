/**
 * Property 1: 画像リサイズはアスペクト比を保持し長辺を1280px以下にする
 * Property 2: 画像バリデーションは許可されたフォーマットとサイズのみ受け付ける
 *
 * fast-check によるプロパティテスト
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateResizedDimensions,
  validateFormat,
  validateFileSize,
  validateDimensions,
} from './image-processor';

describe('Property 1: 画像リサイズはアスペクト比を保持し長辺を1280px以下にする', () => {
  /**
   * **Validates: Requirements 1.3**
   */
  it('リサイズ後の長辺は1280px以下である', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 50, max: 10000 }),
        fc.integer({ min: 50, max: 10000 }),
        (width, height) => {
          const result = calculateResizedDimensions(width, height);
          const longSide = Math.max(result.width, result.height);
          expect(longSide).toBeLessThanOrEqual(1280);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('長辺が1280px以下の画像はリサイズされない', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 50, max: 1280 }),
        fc.integer({ min: 50, max: 1280 }),
        (width, height) => {
          const result = calculateResizedDimensions(width, height);
          expect(result.width).toBe(width);
          expect(result.height).toBe(height);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('アスペクト比が保持される（誤差±1px以内）', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 50, max: 10000 }),
        fc.integer({ min: 50, max: 10000 }),
        (width, height) => {
          const result = calculateResizedDimensions(width, height);
          // リサイズ不要の場合はそのまま返るので比率は完全一致
          if (Math.max(width, height) <= 1280) {
            expect(result.width).toBe(width);
            expect(result.height).toBe(height);
            return;
          }
          // リサイズ時: Math.round による±1pxの丸め誤差を許容
          // result.width = Math.round(width * scale), result.height = Math.round(height * scale)
          // 丸め誤差は各辺で最大0.5px → 比率の誤差は最大 0.5/result.height + 0.5*result.width/result.height^2
          const originalRatio = width / height;
          const resultRatio = result.width / result.height;
          // 寛容なtolerance: 各辺±1pxの丸め誤差を考慮
          const tolerance = 1 / result.height + result.width / (result.height * result.height);
          expect(Math.abs(resultRatio - originalRatio)).toBeLessThanOrEqual(tolerance);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 2: 画像バリデーションは許可されたフォーマットとサイズのみ受け付ける', () => {
  /**
   * **Validates: Requirements 1.4, 1.5, 1.6**
   */

  const validMimeTypes = ['image/jpeg', 'image/png', 'image/heic'];
  const invalidMimeTypes = [
    'image/gif', 'image/webp', 'image/bmp', 'image/tiff', 'image/svg+xml',
    'application/json', 'text/plain', 'video/mp4', 'audio/mpeg',
  ];

  it('許可されたMIMEタイプはvalid=trueを返す', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...validMimeTypes),
        (mimeType) => {
          const file = new File(['dummy'], 'test.jpg', { type: mimeType });
          const result = validateFormat(file);
          expect(result.valid).toBe(true);
          expect(result.errorMessage).toBeUndefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('許可されていないMIMEタイプはvalid=falseとエラーメッセージを返す', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...invalidMimeTypes),
        (mimeType) => {
          const file = new File(['dummy'], 'test.file', { type: mimeType });
          const result = validateFormat(file);
          expect(result.valid).toBe(false);
          expect(result.errorMessage).toBeDefined();
          expect(result.errorMessage!.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('任意のMIMEタイプに対して正しく判定する', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (mimeType) => {
          const file = new File(['dummy'], 'test.file', { type: mimeType });
          const result = validateFormat(file);
          if (validMimeTypes.includes(mimeType)) {
            expect(result.valid).toBe(true);
          } else {
            expect(result.valid).toBe(false);
            expect(result.errorMessage).toBeDefined();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('ファイルサイズ10MB以下はvalid=trueを返す', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 * 1024 * 1024 }),
        (size) => {
          // サイズ分のダミーデータを持つFileオブジェクトを作成
          const content = new Uint8Array(size);
          const file = new File([content], 'test.jpg', { type: 'image/jpeg' });
          const result = validateFileSize(file);
          expect(result.valid).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('ファイルサイズ10MB超過はvalid=falseを返す', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10 * 1024 * 1024 + 1, max: 20 * 1024 * 1024 }),
        (size) => {
          const content = new Uint8Array(size);
          const file = new File([content], 'test.jpg', { type: 'image/jpeg' });
          const result = validateFileSize(file);
          expect(result.valid).toBe(false);
          expect(result.errorMessage).toBeDefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('長辺50px以上はvalid=trueを返す', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 1, max: 10000 }),
        (width, height) => {
          const result = validateDimensions(width, height);
          if (Math.max(width, height) >= 50) {
            expect(result.valid).toBe(true);
          } else {
            expect(result.valid).toBe(false);
            expect(result.errorMessage).toBeDefined();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('長辺50px未満はvalid=falseを返す', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 49 }),
        fc.integer({ min: 1, max: 49 }),
        (width, height) => {
          const result = validateDimensions(width, height);
          expect(result.valid).toBe(false);
          expect(result.errorMessage).toBeDefined();
        },
      ),
      { numRuns: 100 },
    );
  });
});
