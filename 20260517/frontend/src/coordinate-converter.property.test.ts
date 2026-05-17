/**
 * Property 4: 座標変換は[0,1000]スケールをピクセル座標に正確に変換する
 *
 * 任意の[0,1000]スケールの座標値と画像サイズに対して、
 * 変換後のピクセル座標は Math.round(novaCoord * imageDimension / 1000) と±1px以内で一致し、
 * 結果は[0, imageDimension]の範囲内に収まる。
 *
 * **Validates: Requirements 3.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { convertCoordinate } from './coordinate-converter';

describe('Property 4: 座標変換は[0,1000]スケールをピクセル座標に正確に変換する', () => {
  it('変換結果は Math.round(novaCoord * imageDimension / 1000) と±1px以内で一致する', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 50, max: 10000 }),
        (novaCoord, imageDimension) => {
          const result = convertCoordinate(novaCoord, imageDimension);
          const expected = Math.round(novaCoord * imageDimension / 1000);

          // ±1px以内の誤差を許容
          expect(Math.abs(result - expected)).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('変換結果は[0, imageDimension]の範囲内に収まる', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 50, max: 10000 }),
        (novaCoord, imageDimension) => {
          const result = convertCoordinate(novaCoord, imageDimension);

          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(imageDimension);
        }
      ),
      { numRuns: 100 }
    );
  });
});
