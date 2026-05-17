/**
 * 座標変換ユーティリティのテスト
 */

import { describe, it, expect } from 'vitest';
import { convertCoordinate, convertBoundingBox, clampRect } from './coordinate-converter';

describe('convertCoordinate', () => {
  it('0を0に変換する', () => {
    expect(convertCoordinate(0, 1280)).toBe(0);
  });

  it('1000を画像サイズに変換する', () => {
    expect(convertCoordinate(1000, 1280)).toBe(1280);
  });

  it('500を画像サイズの半分に変換する', () => {
    expect(convertCoordinate(500, 1280)).toBe(640);
  });

  it('変換誤差が±1px以内である', () => {
    const novaCoord = 333;
    const imageDimension = 1000;
    const expected = novaCoord * imageDimension / 1000;
    const result = convertCoordinate(novaCoord, imageDimension);
    expect(Math.abs(result - expected)).toBeLessThanOrEqual(1);
  });

  it('小さい画像サイズでも正しく変換する', () => {
    expect(convertCoordinate(500, 100)).toBe(50);
  });
});

describe('convertBoundingBox', () => {
  it('バウンディングボックスをピクセル座標のRectに変換する', () => {
    const box = { x1: 100, y1: 200, x2: 500, y2: 800 };
    const result = convertBoundingBox(box, 1000, 1000);

    expect(result.x).toBe(100);
    expect(result.y).toBe(200);
    expect(result.width).toBe(400);
    expect(result.height).toBe(600);
  });

  it('異なる画像サイズで正しく変換する', () => {
    const box = { x1: 0, y1: 0, x2: 1000, y2: 1000 };
    const result = convertBoundingBox(box, 1280, 720);

    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.width).toBe(1280);
    expect(result.height).toBe(720);
  });

  it('部分的なバウンディングボックスを正しく変換する', () => {
    const box = { x1: 250, y1: 100, x2: 750, y2: 900 };
    const result = convertBoundingBox(box, 1280, 720);

    expect(result.x).toBe(320);
    expect(result.y).toBe(72);
    expect(result.width).toBe(640);
    expect(result.height).toBe(576);
  });
});

describe('clampRect', () => {
  it('画像境界内のRectはそのまま返す', () => {
    const rect = { x: 100, y: 100, width: 200, height: 200 };
    const result = clampRect(rect, 1000, 1000);

    expect(result).toEqual(rect);
  });

  it('負のx座標を0にクランプする', () => {
    const rect = { x: -50, y: 100, width: 200, height: 200 };
    const result = clampRect(rect, 1000, 1000);

    expect(result.x).toBe(0);
    expect(result.y).toBe(100);
  });

  it('負のy座標を0にクランプする', () => {
    const rect = { x: 100, y: -30, width: 200, height: 200 };
    const result = clampRect(rect, 1000, 1000);

    expect(result.x).toBe(100);
    expect(result.y).toBe(0);
  });

  it('右端がはみ出す場合にxを調整する', () => {
    const rect = { x: 900, y: 100, width: 200, height: 200 };
    const result = clampRect(rect, 1000, 1000);

    expect(result.x + result.width).toBeLessThanOrEqual(1000);
    expect(result.width).toBe(200);
  });

  it('下端がはみ出す場合にyを調整する', () => {
    const rect = { x: 100, y: 900, width: 200, height: 200 };
    const result = clampRect(rect, 1000, 1000);

    expect(result.y + result.height).toBeLessThanOrEqual(1000);
    expect(result.height).toBe(200);
  });

  it('最小サイズ未満の幅をminSizeに拡大する', () => {
    const rect = { x: 100, y: 100, width: 10, height: 200 };
    const result = clampRect(rect, 1000, 1000);

    expect(result.width).toBe(20);
  });

  it('最小サイズ未満の高さをminSizeに拡大する', () => {
    const rect = { x: 100, y: 100, width: 200, height: 5 };
    const result = clampRect(rect, 1000, 1000);

    expect(result.height).toBe(20);
  });

  it('カスタムminSizeを適用する', () => {
    const rect = { x: 100, y: 100, width: 25, height: 25 };
    const result = clampRect(rect, 1000, 1000, 30);

    expect(result.width).toBe(30);
    expect(result.height).toBe(30);
  });

  it('すべての制約を同時に満たす', () => {
    const rect = { x: -10, y: -10, width: 5, height: 5 };
    const result = clampRect(rect, 100, 100);

    expect(result.x).toBeGreaterThanOrEqual(0);
    expect(result.y).toBeGreaterThanOrEqual(0);
    expect(result.width).toBeGreaterThanOrEqual(20);
    expect(result.height).toBeGreaterThanOrEqual(20);
    expect(result.x + result.width).toBeLessThanOrEqual(100);
    expect(result.y + result.height).toBeLessThanOrEqual(100);
  });

  it('画像サイズが最小サイズと同じ場合に正しく処理する', () => {
    const rect = { x: 50, y: 50, width: 10, height: 10 };
    const result = clampRect(rect, 20, 20);

    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.width).toBe(20);
    expect(result.height).toBe(20);
  });
});
