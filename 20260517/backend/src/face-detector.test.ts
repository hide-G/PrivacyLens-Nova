/**
 * PrivacyLens Nova - 顔検出モジュール 単体テスト
 *
 * parseBoundingBoxes 関数のパースロジックとバリデーションをテストする。
 * detectFaces 関数は外部API（Bedrock）に依存するため、ここではテストしない。
 */

import { describe, it, expect } from 'vitest';
import { parseBoundingBoxes } from './face-detector.js';

describe('parseBoundingBoxes', () => {
  describe('正常系: JSON配列形式のレスポンス', () => {
    it('単一の顔座標を正しくパースする', () => {
      const response = '[[120, 80, 350, 420]]';
      const result = parseBoundingBoxes(response);
      expect(result).toEqual([{ x1: 120, y1: 80, x2: 350, y2: 420 }]);
    });

    it('複数の顔座標を正しくパースする', () => {
      const response = '[[120, 80, 350, 420], [600, 100, 820, 450]]';
      const result = parseBoundingBoxes(response);
      expect(result).toEqual([
        { x1: 120, y1: 80, x2: 350, y2: 420 },
        { x1: 600, y1: 100, x2: 820, y2: 450 },
      ]);
    });

    it('境界値（0と1000）を含む座標を正しくパースする', () => {
      const response = '[[0, 0, 1000, 1000]]';
      const result = parseBoundingBoxes(response);
      expect(result).toEqual([{ x1: 0, y1: 0, x2: 1000, y2: 1000 }]);
    });

    it('テキストに埋め込まれたJSON配列をパースする', () => {
      const response = 'Here are the detected faces: [[120, 80, 350, 420], [600, 100, 820, 450]] These are the bounding boxes.';
      const result = parseBoundingBoxes(response);
      expect(result).toEqual([
        { x1: 120, y1: 80, x2: 350, y2: 420 },
        { x1: 600, y1: 100, x2: 820, y2: 450 },
      ]);
    });
  });

  describe('正常系: 個別座標パターンのレスポンス', () => {
    it('テキスト内の個別座標パターンをパースする', () => {
      const response = 'Face 1: [120, 80, 350, 420]\nFace 2: [600, 100, 820, 450]';
      const result = parseBoundingBoxes(response);
      expect(result).toEqual([
        { x1: 120, y1: 80, x2: 350, y2: 420 },
        { x1: 600, y1: 100, x2: 820, y2: 450 },
      ]);
    });

    it('小数値を整数に丸めてパースする', () => {
      const response = '[[120.4, 80.6, 350.5, 420.1]]';
      const result = parseBoundingBoxes(response);
      expect(result).toEqual([{ x1: 120, y1: 81, x2: 351, y2: 420 }]);
    });
  });

  describe('正常系: 空のレスポンス', () => {
    it('空配列のレスポンスは空配列を返す', () => {
      const response = '[]';
      const result = parseBoundingBoxes(response);
      expect(result).toEqual([]);
    });

    it('顔が検出されなかったテキストは空配列を返す', () => {
      const response = 'No faces detected in this image.';
      const result = parseBoundingBoxes(response);
      expect(result).toEqual([]);
    });
  });

  describe('バリデーション: 不正な座標の除外', () => {
    it('範囲外の座標（1000超）を除外する', () => {
      const response = '[[120, 80, 1001, 420]]';
      const result = parseBoundingBoxes(response);
      expect(result).toEqual([]);
    });

    it('負の座標を除外する', () => {
      const response = '[[-1, 80, 350, 420]]';
      const result = parseBoundingBoxes(response);
      expect(result).toEqual([]);
    });

    it('x1 >= x2 の座標を除外する', () => {
      const response = '[[350, 80, 120, 420]]';
      const result = parseBoundingBoxes(response);
      expect(result).toEqual([]);
    });

    it('y1 >= y2 の座標を除外する', () => {
      const response = '[[120, 420, 350, 80]]';
      const result = parseBoundingBoxes(response);
      expect(result).toEqual([]);
    });

    it('x1 == x2 の座標を除外する', () => {
      const response = '[[120, 80, 120, 420]]';
      const result = parseBoundingBoxes(response);
      expect(result).toEqual([]);
    });

    it('y1 == y2 の座標を除外する', () => {
      const response = '[[120, 80, 350, 80]]';
      const result = parseBoundingBoxes(response);
      expect(result).toEqual([]);
    });
  });

  describe('最大顔数制限', () => {
    it('最大20個までの顔を返す', () => {
      // 25個の有効な座標を生成
      const boxes = Array.from({ length: 25 }, (_, i) => `[${i * 10}, ${i * 10}, ${i * 10 + 50}, ${i * 10 + 50}]`);
      const response = `[${boxes.join(', ')}]`;
      const result = parseBoundingBoxes(response);
      expect(result.length).toBe(20);
    });
  });

  describe('エッジケース', () => {
    it('空文字列は空配列を返す', () => {
      expect(parseBoundingBoxes('')).toEqual([]);
    });

    it('nullish値は空配列を返す', () => {
      expect(parseBoundingBoxes(null as unknown as string)).toEqual([]);
      expect(parseBoundingBoxes(undefined as unknown as string)).toEqual([]);
    });

    it('有効な座標と無効な座標が混在する場合、有効なもののみ返す', () => {
      const response = '[[120, 80, 350, 420], [1001, 80, 350, 420], [600, 100, 820, 450]]';
      const result = parseBoundingBoxes(response);
      expect(result).toEqual([
        { x1: 120, y1: 80, x2: 350, y2: 420 },
        { x1: 600, y1: 100, x2: 820, y2: 450 },
      ]);
    });
  });
});
