/**
 * Property 10: X Web Intent URLは正しいフォーマットで生成される
 *
 * 任意のテキストとハッシュタグの組み合わせに対して、生成されるURLは
 * `https://twitter.com/intent/tweet?` をベースとし、textパラメータに
 * URLエンコードされたテキストを、hashtagsパラメータに「PrivacyLensNova」を含む。
 *
 * **Validates: Requirements 7.2**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildXIntentUrl } from './share-manager';

describe('Property 10: X Web Intent URLは正しいフォーマットで生成される', () => {
  it('URLは https://twitter.com/intent/tweet? で始まる', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (text, hashtags) => {
          const url = buildXIntentUrl(text, hashtags);

          expect(url).toMatch(/^https:\/\/twitter\.com\/intent\/tweet\?/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('URLは text= パラメータを含む', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (text, hashtags) => {
          const url = buildXIntentUrl(text, hashtags);

          expect(url).toContain('text=');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('URLは hashtags= パラメータを含む', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (text, hashtags) => {
          const url = buildXIntentUrl(text, hashtags);

          expect(url).toContain('hashtags=');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('textパラメータはURLエンコードされたテキストを含む', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (text, hashtags) => {
          const url = buildXIntentUrl(text, hashtags);

          // URLSearchParamsでパースして検証
          const urlObj = new URL(url);
          const decodedText = urlObj.searchParams.get('text');

          expect(decodedText).toBe(text);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('デフォルトハッシュタグは "PrivacyLensNova" を含む', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (text) => {
          // hashtagsを省略した場合のデフォルト値を検証
          const url = buildXIntentUrl(text);

          const urlObj = new URL(url);
          const hashtags = urlObj.searchParams.get('hashtags');

          expect(hashtags).toContain('PrivacyLensNova');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('テキスト省略時はデフォルトテキストが使用される', () => {
    const url = buildXIntentUrl();

    expect(url).toMatch(/^https:\/\/twitter\.com\/intent\/tweet\?/);
    expect(url).toContain('text=');
    expect(url).toContain('hashtags=');

    const urlObj = new URL(url);
    const text = urlObj.searchParams.get('text');
    const hashtags = urlObj.searchParams.get('hashtags');

    expect(text).toBe('PrivacyLens Novaでプライバシー保護しました');
    expect(hashtags).toBe('PrivacyLensNova');
  });
});
