/**
 * Property 3: バウンディングボックスのパースは全座標を正しく抽出する
 *
 * fast-check によるプロパティテスト
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseBoundingBoxes } from './face-detector';

describe('Property 3: バウンディングボックスのパースは全座標を正しく抽出する', () => {
  /**
   * **Validates: Requirements 2.2, 2.3**
   */

  /** 有効なバウンディングボックスのジェネレータ */
  const validBoundingBoxArb = fc.tuple(
    fc.integer({ min: 0, max: 998 }),
    fc.integer({ min: 0, max: 998 }),
  ).chain(([x1, y1]) =>
    fc.tuple(
      fc.constant(x1),
      fc.constant(y1),
      fc.integer({ min: x1 + 1, max: 1000 }),
      fc.integer({ min: y1 + 1, max: 1000 }),
    ),
  );

  /** バウンディングボックス配列のジェネレータ（0〜20個） */
  const boundingBoxArrayArb = fc.array(validBoundingBoxArb, { minLength: 0, maxLength: 20 });

  it('有効なバウンディングボックスはすべて正しく抽出される', () => {
    fc.assert(
      fc.property(boundingBoxArrayArb, (boxes) => {
        // JSON文字列としてフォーマット
        const jsonStr = JSON.stringify(boxes);
        const result = parseBoundingBoxes(jsonStr);

        // すべての有効なボックスが抽出される
        expect(result.length).toBe(boxes.length);

        // 各結果の座標が正しいことを検証
        for (let i = 0; i < result.length; i++) {
          expect(result[i].x1).toBe(boxes[i][0]);
          expect(result[i].y1).toBe(boxes[i][1]);
          expect(result[i].x2).toBe(boxes[i][2]);
          expect(result[i].y2).toBe(boxes[i][3]);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('パース結果の各座標は0以上1000以下である', () => {
    fc.assert(
      fc.property(boundingBoxArrayArb, (boxes) => {
        const jsonStr = JSON.stringify(boxes);
        const result = parseBoundingBoxes(jsonStr);

        for (const box of result) {
          expect(box.x1).toBeGreaterThanOrEqual(0);
          expect(box.x1).toBeLessThanOrEqual(1000);
          expect(box.y1).toBeGreaterThanOrEqual(0);
          expect(box.y1).toBeLessThanOrEqual(1000);
          expect(box.x2).toBeGreaterThanOrEqual(0);
          expect(box.x2).toBeLessThanOrEqual(1000);
          expect(box.y2).toBeGreaterThanOrEqual(0);
          expect(box.y2).toBeLessThanOrEqual(1000);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('パース結果はx1<x2かつy1<y2を満たす', () => {
    fc.assert(
      fc.property(boundingBoxArrayArb, (boxes) => {
        const jsonStr = JSON.stringify(boxes);
        const result = parseBoundingBoxes(jsonStr);

        for (const box of result) {
          expect(box.x1).toBeLessThan(box.x2);
          expect(box.y1).toBeLessThan(box.y2);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('パース結果は最大20個に制限される', () => {
    fc.assert(
      fc.property(
        fc.array(validBoundingBoxArb, { minLength: 21, maxLength: 30 }),
        (boxes) => {
          const jsonStr = JSON.stringify(boxes);
          const result = parseBoundingBoxes(jsonStr);

          expect(result.length).toBeLessThanOrEqual(20);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('テキスト内に埋め込まれた座標も正しく抽出される', () => {
    fc.assert(
      fc.property(validBoundingBoxArb, ([x1, y1, x2, y2]) => {
        // テキスト内に座標を埋め込む
        const text = `I found a face at [${x1}, ${y1}, ${x2}, ${y2}] in the image.`;
        const result = parseBoundingBoxes(text);

        expect(result.length).toBe(1);
        expect(result[0].x1).toBe(x1);
        expect(result[0].y1).toBe(y1);
        expect(result[0].x2).toBe(x2);
        expect(result[0].y2).toBe(y2);
      }),
      { numRuns: 100 },
    );
  });
});
