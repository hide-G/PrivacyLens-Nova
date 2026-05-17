/**
 * Property 5: すべてのマスク操作後にマスク矩形は画像境界内に収まる
 * Property 7: マスクの追加は件数を1増加させ、削除は1減少させる
 * Property 8: Undo操作は直前の状態を最大10回まで復元する
 *
 * **Validates: Requirements 3.7, 4.1, 4.2, 4.4, 4.5, 4.8, 4.9**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { MaskManager } from './mask-manager';

describe('Property 5: すべてのマスク操作後にマスク矩形は画像境界内に収まる', () => {
  it('マスク追加後、矩形は画像境界内かつ最小サイズ以上である', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 50, max: 5000 }),
        fc.integer({ min: 50, max: 5000 }),
        fc.integer({ min: -500, max: 5500 }),
        fc.integer({ min: -500, max: 5500 }),
        (imageWidth, imageHeight, centerX, centerY) => {
          const manager = new MaskManager(imageWidth, imageHeight);
          const mask = manager.addMask(centerX, centerY);

          expect(mask.rect.x).toBeGreaterThanOrEqual(0);
          expect(mask.rect.y).toBeGreaterThanOrEqual(0);
          expect(mask.rect.x + mask.rect.width).toBeLessThanOrEqual(imageWidth);
          expect(mask.rect.y + mask.rect.height).toBeLessThanOrEqual(imageHeight);
          expect(mask.rect.width).toBeGreaterThanOrEqual(20);
          expect(mask.rect.height).toBeGreaterThanOrEqual(20);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('マスク移動後、矩形は画像境界内かつ最小サイズ以上である', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 5000 }),
        fc.integer({ min: 100, max: 5000 }),
        fc.integer({ min: -5000, max: 5000 }),
        fc.integer({ min: -5000, max: 5000 }),
        (imageWidth, imageHeight, deltaX, deltaY) => {
          const manager = new MaskManager(imageWidth, imageHeight);
          const mask = manager.addMask(imageWidth / 2, imageHeight / 2);
          manager.moveMask(mask.id, deltaX, deltaY);

          const masks = manager.getMasks();
          for (const m of masks) {
            expect(m.rect.x).toBeGreaterThanOrEqual(0);
            expect(m.rect.y).toBeGreaterThanOrEqual(0);
            expect(m.rect.x + m.rect.width).toBeLessThanOrEqual(imageWidth);
            expect(m.rect.y + m.rect.height).toBeLessThanOrEqual(imageHeight);
            expect(m.rect.width).toBeGreaterThanOrEqual(20);
            expect(m.rect.height).toBeGreaterThanOrEqual(20);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('マスクリサイズ後、矩形は画像境界内かつ最小サイズ以上である', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 5000 }),
        fc.integer({ min: 100, max: 5000 }),
        fc.integer({ min: -100, max: 5000 }),
        fc.integer({ min: -100, max: 5000 }),
        fc.integer({ min: 5, max: 6000 }),
        fc.integer({ min: 5, max: 6000 }),
        (imageWidth, imageHeight, newX, newY, newWidth, newHeight) => {
          const manager = new MaskManager(imageWidth, imageHeight);
          const mask = manager.addMask(imageWidth / 2, imageHeight / 2);
          manager.resizeMask(mask.id, { x: newX, y: newY, width: newWidth, height: newHeight });

          const masks = manager.getMasks();
          for (const m of masks) {
            expect(m.rect.x).toBeGreaterThanOrEqual(0);
            expect(m.rect.y).toBeGreaterThanOrEqual(0);
            expect(m.rect.x + m.rect.width).toBeLessThanOrEqual(imageWidth);
            expect(m.rect.y + m.rect.height).toBeLessThanOrEqual(imageHeight);
            expect(m.rect.width).toBeGreaterThanOrEqual(20);
            expect(m.rect.height).toBeGreaterThanOrEqual(20);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 7: マスクの追加は件数を1増加させ、削除は1減少させる', () => {
  it('addMask はリスト長を1増加させる', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 2000 }),
        fc.integer({ min: 100, max: 2000 }),
        fc.array(
          fc.record({
            x: fc.integer({ min: 0, max: 1000 }),
            y: fc.integer({ min: 0, max: 1000 }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        (imageWidth, imageHeight, positions) => {
          const manager = new MaskManager(imageWidth, imageHeight);

          // 初期マスクを追加
          for (const pos of positions) {
            manager.addMask(pos.x, pos.y);
          }

          const countBefore = manager.getMasks().length;
          manager.addMask(imageWidth / 2, imageHeight / 2);
          const countAfter = manager.getMasks().length;

          expect(countAfter).toBe(countBefore + 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('removeMask はリスト長を1減少させる', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 2000 }),
        fc.integer({ min: 100, max: 2000 }),
        fc.integer({ min: 1, max: 5 }),
        (imageWidth, imageHeight, maskCount) => {
          const manager = new MaskManager(imageWidth, imageHeight);

          // マスクを追加
          for (let i = 0; i < maskCount; i++) {
            manager.addMask(
              Math.floor(imageWidth * (i + 1) / (maskCount + 1)),
              Math.floor(imageHeight / 2)
            );
          }

          const masks = manager.getMasks();
          const countBefore = masks.length;
          const maskToRemove = masks[0];

          manager.removeMask(maskToRemove.id);
          const countAfter = manager.getMasks().length;

          expect(countAfter).toBe(countBefore - 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('removeMask 後、削除されたマスクはリストに存在しない', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 2000 }),
        fc.integer({ min: 100, max: 2000 }),
        (imageWidth, imageHeight) => {
          const manager = new MaskManager(imageWidth, imageHeight);
          const mask = manager.addMask(imageWidth / 2, imageHeight / 2);

          manager.removeMask(mask.id);
          const remaining = manager.getMasks();

          expect(remaining.find(m => m.id === mask.id)).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 8: Undo操作は直前の状態を最大10回まで復元する', () => {
  it('Undo操作は直前の状態を復元する', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 200, max: 2000 }),
        fc.integer({ min: 200, max: 2000 }),
        (imageWidth, imageHeight) => {
          const manager = new MaskManager(imageWidth, imageHeight);

          // 操作前の状態を記録
          const stateBefore = JSON.stringify(manager.getMasks());

          // マスクを追加
          manager.addMask(imageWidth / 2, imageHeight / 2);

          // Undoで元に戻す
          manager.undo();
          const stateAfter = JSON.stringify(manager.getMasks());

          expect(stateAfter).toBe(stateBefore);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('最大10回のUndo操作が可能である', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (operationCount) => {
          const manager = new MaskManager(500, 500);

          // N回の操作を実行
          for (let i = 0; i < operationCount; i++) {
            manager.addMask(50 + i * 20, 50 + i * 20);
          }

          // Undo可能回数を確認
          let undoCount = 0;
          while (manager.canUndo()) {
            manager.undo();
            undoCount++;
          }

          // 最大10回まで
          expect(undoCount).toBe(Math.min(operationCount, 10));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Undo後のマスク状態は操作前の状態と一致する', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 200, max: 2000 }),
        fc.integer({ min: 200, max: 2000 }),
        fc.array(
          fc.record({
            x: fc.integer({ min: 50, max: 400 }),
            y: fc.integer({ min: 50, max: 400 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (imageWidth, imageHeight, positions) => {
          const manager = new MaskManager(imageWidth, imageHeight);

          // 各操作前の状態を記録
          const states: string[] = [];

          for (const pos of positions) {
            states.push(JSON.stringify(manager.getMasks()));
            manager.addMask(pos.x, pos.y);
          }

          // 逆順にUndoして状態を検証
          for (let i = states.length - 1; i >= Math.max(0, states.length - 10); i--) {
            manager.undo();
            const currentState = JSON.stringify(manager.getMasks());
            expect(currentState).toBe(states[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
