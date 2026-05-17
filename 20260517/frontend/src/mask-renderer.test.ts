/**
 * MaskRenderer テスト
 *
 * Canvas APIはブラウザ専用のため、クラスのインスタンス化と
 * 基本的なメソッド存在確認のみを行う。
 * 実際の描画テストはE2Eテスト（Playwright）で実施する。
 */

import { describe, it, expect } from 'vitest';
import { MaskRenderer } from './mask-renderer';

describe('MaskRenderer', () => {
  it('クラスをインスタンス化できる', () => {
    const renderer = new MaskRenderer();
    expect(renderer).toBeInstanceOf(MaskRenderer);
  });

  it('初期化前のgetOriginalImageDataはnullを返す', () => {
    const renderer = new MaskRenderer();
    expect(renderer.getOriginalImageData()).toBeNull();
  });

  it('destroyを呼び出してもエラーが発生しない', () => {
    const renderer = new MaskRenderer();
    expect(() => renderer.destroy()).not.toThrow();
  });

  it('初期化前のrenderを呼び出してもエラーが発生しない', () => {
    const renderer = new MaskRenderer();
    expect(() => renderer.render([], 'medium', 1.0)).not.toThrow();
  });

  it('初期化前のexportImageはエラーをスローする', async () => {
    const renderer = new MaskRenderer();
    await expect(renderer.exportImage([], 'medium')).rejects.toThrow(
      'MaskRendererが初期化されていません'
    );
  });
});
