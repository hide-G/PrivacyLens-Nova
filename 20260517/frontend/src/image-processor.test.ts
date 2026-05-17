/**
 * ImageProcessor 単体テスト
 *
 * validateFormat, validateFileSize, validateDimensions, validateSize,
 * calculateResizedDimensions の動作を検証する。
 * Canvas APIを使用する resizeImage, processImage はブラウザ環境依存のため、
 * 純粋関数のロジックテストに集中する。
 */

import { describe, it, expect } from 'vitest';
import {
  validateFormat,
  validateFileSize,
  validateDimensions,
  validateSize,
  calculateResizedDimensions,
} from './image-processor';

/** テスト用のモックFileを生成するヘルパー */
function createMockFile(options: {
  name?: string;
  type?: string;
  size?: number;
}): File {
  const { name = 'test.jpg', type = 'image/jpeg', size = 1024 } = options;
  // 指定サイズのArrayBufferを作成
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

describe('validateFormat', () => {
  it('JPEG形式を許可する', () => {
    const file = createMockFile({ type: 'image/jpeg' });
    const result = validateFormat(file);
    expect(result.valid).toBe(true);
    expect(result.errorMessage).toBeUndefined();
  });

  it('PNG形式を許可する', () => {
    const file = createMockFile({ type: 'image/png' });
    const result = validateFormat(file);
    expect(result.valid).toBe(true);
  });

  it('HEIC形式を許可する', () => {
    const file = createMockFile({ type: 'image/heic' });
    const result = validateFormat(file);
    expect(result.valid).toBe(true);
  });

  it('GIF形式を拒否する', () => {
    const file = createMockFile({ type: 'image/gif' });
    const result = validateFormat(file);
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toBe('対応形式: JPEG, PNG, HEIC');
  });

  it('WebP形式を拒否する', () => {
    const file = createMockFile({ type: 'image/webp' });
    const result = validateFormat(file);
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toBe('対応形式: JPEG, PNG, HEIC');
  });

  it('空のMIMEタイプを拒否する', () => {
    const file = createMockFile({ type: '' });
    const result = validateFormat(file);
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toBe('対応形式: JPEG, PNG, HEIC');
  });

  it('テキストファイルを拒否する', () => {
    const file = createMockFile({ type: 'text/plain' });
    const result = validateFormat(file);
    expect(result.valid).toBe(false);
  });
});

describe('validateFileSize', () => {
  it('10MB以下のファイルを許可する', () => {
    const file = createMockFile({ size: 10 * 1024 * 1024 });
    const result = validateFileSize(file);
    expect(result.valid).toBe(true);
  });

  it('ちょうど10MBのファイルを許可する', () => {
    const file = createMockFile({ size: 10 * 1024 * 1024 });
    const result = validateFileSize(file);
    expect(result.valid).toBe(true);
  });

  it('10MBを超えるファイルを拒否する', () => {
    const file = createMockFile({ size: 10 * 1024 * 1024 + 1 });
    const result = validateFileSize(file);
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toBe('ファイルサイズが10MBを超えています');
  });

  it('1バイトのファイルを許可する', () => {
    const file = createMockFile({ size: 1 });
    const result = validateFileSize(file);
    expect(result.valid).toBe(true);
  });
});

describe('validateDimensions', () => {
  it('長辺50pxの画像を許可する', () => {
    const result = validateDimensions(50, 30);
    expect(result.valid).toBe(true);
  });

  it('長辺が50px未満の画像を拒否する', () => {
    const result = validateDimensions(49, 30);
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toBe('画像が小さすぎます。長辺50px以上の画像を選択してください');
  });

  it('幅が短辺で高さが長辺の場合も正しく判定する', () => {
    const result = validateDimensions(30, 50);
    expect(result.valid).toBe(true);
  });

  it('幅も高さも50px未満の場合を拒否する', () => {
    const result = validateDimensions(10, 10);
    expect(result.valid).toBe(false);
  });

  it('大きな画像を許可する', () => {
    const result = validateDimensions(4000, 3000);
    expect(result.valid).toBe(true);
  });
});

describe('validateSize', () => {
  it('サイズと寸法の両方が有効な場合にvalidを返す', () => {
    const file = createMockFile({ size: 5 * 1024 * 1024 });
    const result = validateSize(file, 1920, 1080);
    expect(result.valid).toBe(true);
  });

  it('ファイルサイズ超過時にファイルサイズエラーを返す', () => {
    const file = createMockFile({ size: 11 * 1024 * 1024 });
    const result = validateSize(file, 1920, 1080);
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toBe('ファイルサイズが10MBを超えています');
  });

  it('寸法不足時に寸法エラーを返す', () => {
    const file = createMockFile({ size: 1024 });
    const result = validateSize(file, 30, 20);
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toBe('画像が小さすぎます。長辺50px以上の画像を選択してください');
  });

  it('ファイルサイズと寸法の両方が無効な場合、ファイルサイズエラーを優先する', () => {
    const file = createMockFile({ size: 11 * 1024 * 1024 });
    const result = validateSize(file, 30, 20);
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toBe('ファイルサイズが10MBを超えています');
  });
});

describe('calculateResizedDimensions', () => {
  it('長辺1280px以下の画像はリサイズしない', () => {
    const result = calculateResizedDimensions(1280, 720);
    expect(result.width).toBe(1280);
    expect(result.height).toBe(720);
  });

  it('ちょうど1280pxの画像はリサイズしない', () => {
    const result = calculateResizedDimensions(1280, 1280);
    expect(result.width).toBe(1280);
    expect(result.height).toBe(1280);
  });

  it('横長画像を正しくリサイズする（幅が長辺）', () => {
    const result = calculateResizedDimensions(2560, 1440);
    expect(result.width).toBe(1280);
    expect(result.height).toBe(720);
    // アスペクト比確認
    expect(Math.abs(result.width / result.height - 2560 / 1440)).toBeLessThan(0.01);
  });

  it('縦長画像を正しくリサイズする（高さが長辺）', () => {
    const result = calculateResizedDimensions(1080, 1920);
    expect(result.width).toBe(720);
    expect(result.height).toBe(1280);
  });

  it('正方形画像を正しくリサイズする', () => {
    const result = calculateResizedDimensions(2000, 2000);
    expect(result.width).toBe(1280);
    expect(result.height).toBe(1280);
  });

  it('非常に大きな画像を正しくリサイズする', () => {
    const result = calculateResizedDimensions(10000, 5000);
    expect(result.width).toBe(1280);
    expect(result.height).toBe(640);
  });

  it('リサイズ後の長辺が1280pxを超えない', () => {
    const result = calculateResizedDimensions(3840, 2160);
    expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(1280);
  });

  it('小さな画像（50px）はリサイズしない', () => {
    const result = calculateResizedDimensions(50, 30);
    expect(result.width).toBe(50);
    expect(result.height).toBe(30);
  });

  it('アスペクト比が保持される（誤差±1px以内）', () => {
    const originalWidth = 4032;
    const originalHeight = 3024;
    const result = calculateResizedDimensions(originalWidth, originalHeight);

    // 元のアスペクト比
    const originalRatio = originalWidth / originalHeight;
    // リサイズ後のアスペクト比
    const resizedRatio = result.width / result.height;

    // ±1px の誤差を許容
    const expectedHeight = Math.round(result.width / originalRatio);
    expect(Math.abs(result.height - expectedHeight)).toBeLessThanOrEqual(1);
  });
});
