/**
 * Property 9: ズームレベルは1.0〜5.0の範囲にクランプされる
 *
 * 任意のズーム操作に対して、結果のズームレベルは1.0以上5.0以下の範囲に収まる。
 *
 * **Validates: Requirements 4.7**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { clampZoom, ZoomManager } from './zoom-manager';

describe('Property 9: ズームレベルは1.0〜5.0の範囲にクランプされる', () => {
  it('clampZoom は任意の値を[1.0, 5.0]にクランプする', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -10.0, max: 100.0, noNaN: true }),
        (value) => {
          const result = clampZoom(value);

          expect(result).toBeGreaterThanOrEqual(1.0);
          expect(result).toBeLessThanOrEqual(5.0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('clampZoom は範囲内の値をそのまま返す', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1.0, max: 5.0, noNaN: true }),
        (value) => {
          const result = clampZoom(value);

          expect(result).toBe(value);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('ZoomManager.setZoom() は任意の値を[1.0, 5.0]にクランプする', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -10.0, max: 100.0, noNaN: true }),
        (value) => {
          const manager = new ZoomManager();
          manager.setZoom(value);
          const result = manager.getZoom();

          expect(result).toBeGreaterThanOrEqual(1.0);
          expect(result).toBeLessThanOrEqual(5.0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('ZoomManager.zoomIn() は結果を[1.0, 5.0]にクランプする', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 50.0, noNaN: true }),
        (delta) => {
          const manager = new ZoomManager();
          manager.zoomIn(delta);
          const result = manager.getZoom();

          expect(result).toBeGreaterThanOrEqual(1.0);
          expect(result).toBeLessThanOrEqual(5.0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('ZoomManager.zoomOut() は結果を[1.0, 5.0]にクランプする', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 50.0, noNaN: true }),
        (delta) => {
          const manager = new ZoomManager();
          // まずズームインしてから
          manager.setZoom(3.0);
          manager.zoomOut(delta);
          const result = manager.getZoom();

          expect(result).toBeGreaterThanOrEqual(1.0);
          expect(result).toBeLessThanOrEqual(5.0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('連続するズーム操作後も常に[1.0, 5.0]の範囲内である', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.record({ type: fc.constant('set' as const), value: fc.double({ min: -10.0, max: 100.0, noNaN: true }) }),
            fc.record({ type: fc.constant('in' as const), value: fc.double({ min: 0.1, max: 10.0, noNaN: true }) }),
            fc.record({ type: fc.constant('out' as const), value: fc.double({ min: 0.1, max: 10.0, noNaN: true }) })
          ),
          { minLength: 1, maxLength: 20 }
        ),
        (operations) => {
          const manager = new ZoomManager();

          for (const op of operations) {
            switch (op.type) {
              case 'set':
                manager.setZoom(op.value);
                break;
              case 'in':
                manager.zoomIn(op.value);
                break;
              case 'out':
                manager.zoomOut(op.value);
                break;
            }

            const result = manager.getZoom();
            expect(result).toBeGreaterThanOrEqual(1.0);
            expect(result).toBeLessThanOrEqual(5.0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
