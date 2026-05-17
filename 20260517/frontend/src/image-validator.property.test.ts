/**
 * Property 2: 画像バリデーションは許可されたフォーマットとサイズのみ受け付ける
 *
 * Feature: privacy-lens-nova, Property 2: 画像バリデーションは許可されたフォーマットとサイズのみ受け付ける
 *
 * Validates: Requirements 1.4, 1.5, 1.6
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateFormat, validateFileSize, validateDimensions } from './image-processor';

/** 許可されたMIMEタイプ */
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/heic'];

/** 最大ファイルサイズ (10MB) */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** 最小画像長辺 (50px) */
const MIN_LONG_SIDE_PX = 50;

/**
 * モックFileオブジェクトを生成するヘルパー関数
 */
function createMockFile(mimeType: string, size: number): File {
  // 指定サイズのArrayBufferを作成（実際のデータは不要）
  const buffer = new ArrayBuffer(Math.min(size, 1024));
  const blob = new Blob([buffer], { type: mimeType });

  // Fileオブジェクトを生成（sizeプロパティをオーバーライド）
  const file = new File([blob], 'test-image.jpg', { type: mimeType });

  // sizeプロパティをオーバーライドして任意のサイズを設定
  Object.defineProperty(file, 'size', { value: size, writable: false });

  return file;
}

/**
 * 無効なMIMEタイプのジェネレータ
 */
const invalidMimeTypeArb = fc.oneof(
  fc.constant('image/gif'),
  fc.constant('image/webp'),
  fc.constant('image/bmp'),
  fc.constant('image/tiff'),
  fc.constant('image/svg+xml'),
  fc.constant('application/pdf'),
  fc.constant('text/plain'),
  fc.constant('video/mp4'),
  fc.constant(''),
  fc.stringOf(fc.char(), { minLength: 1, maxLength: 50 }).filter(
    (s) => !ALLOWED_MIME_TYPES.includes(s)
  )
);

/**
 * 有効なMIMEタイプのジェネレータ
 */
const validMimeTypeArb = fc.constantFrom(...ALLOWED_MIME_TYPES);

/**
 * 任意のMIMEタイプのジェネレータ（有効・無効混合）
 */
const anyMimeTypeArb = fc.oneof(validMimeTypeArb, invalidMimeTypeArb);

/**
 * ファイルサイズのジェネレータ（0〜20MB）
 */
const fileSizeArb = fc.integer({ min: 0, max: 20 * 1024 * 1024 });

/**
 * 画像寸法のジェネレータ（1〜10000px）
 */
const dimensionArb = fc.integer({ min: 1, max: 10000 });

describe('Property 2: 画像バリデーションは許可されたフォーマットとサイズのみ受け付ける', () => {
  describe('validateFormat - MIMEタイプ検証', () => {
    it('許可されたMIMEタイプの場合のみvalidを返す', () => {
      fc.assert(
        fc.property(anyMimeTypeArb, (mimeType) => {
          const file = createMockFile(mimeType, 1024);
          const result = validateFormat(file);

          if (ALLOWED_MIME_TYPES.includes(mimeType)) {
            // 許可されたMIMEタイプ → valid
            expect(result.valid).toBe(true);
            expect(result.errorMessage).toBeUndefined();
          } else {
            // 許可されていないMIMEタイプ → invalid + 日本語エラーメッセージ
            expect(result.valid).toBe(false);
            expect(result.errorMessage).toBeDefined();
            expect(result.errorMessage).toContain('JPEG');
            expect(result.errorMessage).toContain('PNG');
            expect(result.errorMessage).toContain('HEIC');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('無効なMIMEタイプは常にinvalidを返す', () => {
      fc.assert(
        fc.property(invalidMimeTypeArb, (mimeType) => {
          const file = createMockFile(mimeType, 1024);
          const result = validateFormat(file);

          expect(result.valid).toBe(false);
          expect(result.errorMessage).toBeDefined();
          expect(typeof result.errorMessage).toBe('string');
          expect(result.errorMessage!.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('有効なMIMEタイプは常にvalidを返す', () => {
      fc.assert(
        fc.property(validMimeTypeArb, (mimeType) => {
          const file = createMockFile(mimeType, 1024);
          const result = validateFormat(file);

          expect(result.valid).toBe(true);
          expect(result.errorMessage).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('validateFileSize - ファイルサイズ検証', () => {
    it('10MB以下の場合のみvalidを返す', () => {
      fc.assert(
        fc.property(fileSizeArb, (size) => {
          const file = createMockFile('image/jpeg', size);
          const result = validateFileSize(file);

          if (size <= MAX_FILE_SIZE_BYTES) {
            // 10MB以下 → valid
            expect(result.valid).toBe(true);
            expect(result.errorMessage).toBeUndefined();
          } else {
            // 10MB超過 → invalid + 日本語エラーメッセージ
            expect(result.valid).toBe(false);
            expect(result.errorMessage).toBeDefined();
            expect(result.errorMessage).toContain('10MB');
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('validateDimensions - 画像寸法検証', () => {
    it('長辺50px以上の場合のみvalidを返す', () => {
      fc.assert(
        fc.property(dimensionArb, dimensionArb, (width, height) => {
          const result = validateDimensions(width, height);
          const longSide = Math.max(width, height);

          if (longSide >= MIN_LONG_SIDE_PX) {
            // 長辺50px以上 → valid
            expect(result.valid).toBe(true);
            expect(result.errorMessage).toBeUndefined();
          } else {
            // 長辺50px未満 → invalid + 日本語エラーメッセージ
            expect(result.valid).toBe(false);
            expect(result.errorMessage).toBeDefined();
            expect(result.errorMessage).toContain('50px');
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('統合バリデーション - 全条件の組み合わせ', () => {
    it('MIMEタイプ・サイズ・寸法すべてが有効な場合のみ全バリデーションがvalidを返す', () => {
      fc.assert(
        fc.property(
          anyMimeTypeArb,
          fileSizeArb,
          dimensionArb,
          dimensionArb,
          (mimeType, size, width, height) => {
            const file = createMockFile(mimeType, size);
            const longSide = Math.max(width, height);

            const formatResult = validateFormat(file);
            const sizeResult = validateFileSize(file);
            const dimensionsResult = validateDimensions(width, height);

            const isFormatValid = ALLOWED_MIME_TYPES.includes(mimeType);
            const isSizeValid = size <= MAX_FILE_SIZE_BYTES;
            const isDimensionsValid = longSide >= MIN_LONG_SIDE_PX;

            // フォーマット検証
            expect(formatResult.valid).toBe(isFormatValid);

            // サイズ検証
            expect(sizeResult.valid).toBe(isSizeValid);

            // 寸法検証
            expect(dimensionsResult.valid).toBe(isDimensionsValid);

            // すべてvalidの場合のみ全体がvalid
            const allValid = isFormatValid && isSizeValid && isDimensionsValid;

            if (allValid) {
              expect(formatResult.valid).toBe(true);
              expect(sizeResult.valid).toBe(true);
              expect(dimensionsResult.valid).toBe(true);
            } else {
              // 少なくとも1つがinvalid
              const hasInvalid =
                !formatResult.valid || !sizeResult.valid || !dimensionsResult.valid;
              expect(hasInvalid).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('無効な場合は適切な日本語エラーメッセージが返される', () => {
      fc.assert(
        fc.property(
          anyMimeTypeArb,
          fileSizeArb,
          dimensionArb,
          dimensionArb,
          (mimeType, size, width, height) => {
            const file = createMockFile(mimeType, size);

            const formatResult = validateFormat(file);
            const sizeResult = validateFileSize(file);
            const dimensionsResult = validateDimensions(width, height);

            // 無効な結果にはすべて日本語エラーメッセージが含まれる
            if (!formatResult.valid) {
              expect(formatResult.errorMessage).toBeDefined();
              expect(typeof formatResult.errorMessage).toBe('string');
              expect(formatResult.errorMessage!.length).toBeGreaterThan(0);
            }

            if (!sizeResult.valid) {
              expect(sizeResult.errorMessage).toBeDefined();
              expect(typeof sizeResult.errorMessage).toBe('string');
              expect(sizeResult.errorMessage!.length).toBeGreaterThan(0);
            }

            if (!dimensionsResult.valid) {
              expect(dimensionsResult.errorMessage).toBeDefined();
              expect(typeof dimensionsResult.errorMessage).toBe('string');
              expect(dimensionsResult.errorMessage!.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
