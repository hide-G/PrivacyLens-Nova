/**
 * MaskManager 単体テスト
 *
 * マスクの追加・削除・移動・リサイズ・選択・Undo操作を検証する。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MaskManager } from './mask-manager';

// crypto.randomUUID のモック
vi.stubGlobal('crypto', {
  randomUUID: () => {
    return `${Math.random().toString(36).substring(2, 10)}-${Date.now().toString(36)}`;
  },
});

describe('MaskManager', () => {
  let manager: MaskManager;
  const imageWidth = 800;
  const imageHeight = 600;

  beforeEach(() => {
    manager = new MaskManager(imageWidth, imageHeight);
  });

  describe('addMask', () => {
    it('指定位置を中心に100x100pxのマスクを追加する', () => {
      const mask = manager.addMask(400, 300);

      expect(mask.rect.width).toBe(100);
      expect(mask.rect.height).toBe(100);
      expect(mask.rect.x).toBe(350);
      expect(mask.rect.y).toBe(250);
    });

    it('追加されたマスクはIDを持つ', () => {
      const mask = manager.addMask(400, 300);

      expect(mask.id).toBeDefined();
      expect(typeof mask.id).toBe('string');
      expect(mask.id.length).toBeGreaterThan(0);
    });

    it('追加されたマスクは未選択状態', () => {
      const mask = manager.addMask(400, 300);

      expect(mask.selected).toBe(false);
    });

    it('画像左上端付近に追加した場合、境界内にクランプされる', () => {
      const mask = manager.addMask(10, 10);

      expect(mask.rect.x).toBeGreaterThanOrEqual(0);
      expect(mask.rect.y).toBeGreaterThanOrEqual(0);
      expect(mask.rect.width).toBe(100);
      expect(mask.rect.height).toBe(100);
    });

    it('画像右下端付近に追加した場合、境界内にクランプされる', () => {
      const mask = manager.addMask(790, 590);

      expect(mask.rect.x + mask.rect.width).toBeLessThanOrEqual(imageWidth);
      expect(mask.rect.y + mask.rect.height).toBeLessThanOrEqual(imageHeight);
    });

    it('マスクリストに追加される', () => {
      expect(manager.getMasks()).toHaveLength(0);

      manager.addMask(400, 300);
      expect(manager.getMasks()).toHaveLength(1);

      manager.addMask(200, 100);
      expect(manager.getMasks()).toHaveLength(2);
    });

    it('各マスクは一意のIDを持つ', () => {
      const mask1 = manager.addMask(100, 100);
      const mask2 = manager.addMask(200, 200);

      expect(mask1.id).not.toBe(mask2.id);
    });
  });

  describe('removeMask', () => {
    it('指定IDのマスクを削除する', () => {
      const mask = manager.addMask(400, 300);
      expect(manager.getMasks()).toHaveLength(1);

      manager.removeMask(mask.id);
      expect(manager.getMasks()).toHaveLength(0);
    });

    it('存在しないIDを指定した場合、何もしない', () => {
      manager.addMask(400, 300);
      expect(manager.getMasks()).toHaveLength(1);

      manager.removeMask('non-existent-id');
      expect(manager.getMasks()).toHaveLength(1);
    });

    it('選択中のマスクを削除した場合、選択状態がクリアされる', () => {
      const mask = manager.addMask(400, 300);
      manager.selectMask(mask.id);
      expect(manager.getSelectedMask()).not.toBeNull();

      manager.removeMask(mask.id);
      expect(manager.getSelectedMask()).toBeNull();
    });

    it('複数マスクから特定のマスクのみ削除する', () => {
      const mask1 = manager.addMask(100, 100);
      const mask2 = manager.addMask(200, 200);
      const mask3 = manager.addMask(300, 300);

      manager.removeMask(mask2.id);

      const masks = manager.getMasks();
      expect(masks).toHaveLength(2);
      expect(masks.find(m => m.id === mask1.id)).toBeDefined();
      expect(masks.find(m => m.id === mask2.id)).toBeUndefined();
      expect(masks.find(m => m.id === mask3.id)).toBeDefined();
    });
  });

  describe('moveMask', () => {
    it('マスクを指定量だけ移動する', () => {
      const mask = manager.addMask(400, 300);
      const originalX = mask.rect.x;
      const originalY = mask.rect.y;

      manager.moveMask(mask.id, 50, 30);

      const movedMask = manager.getMasks().find(m => m.id === mask.id)!;
      expect(movedMask.rect.x).toBe(originalX + 50);
      expect(movedMask.rect.y).toBe(originalY + 30);
    });

    it('移動後もサイズは変わらない', () => {
      const mask = manager.addMask(400, 300);
      const originalWidth = mask.rect.width;
      const originalHeight = mask.rect.height;

      manager.moveMask(mask.id, 50, 30);

      const movedMask = manager.getMasks().find(m => m.id === mask.id)!;
      expect(movedMask.rect.width).toBe(originalWidth);
      expect(movedMask.rect.height).toBe(originalHeight);
    });

    it('画像境界を超える移動はクランプされる', () => {
      const mask = manager.addMask(400, 300);

      // 右方向に大きく移動
      manager.moveMask(mask.id, 1000, 0);

      const movedMask = manager.getMasks().find(m => m.id === mask.id)!;
      expect(movedMask.rect.x + movedMask.rect.width).toBeLessThanOrEqual(imageWidth);
    });

    it('負の方向に大きく移動してもクランプされる', () => {
      const mask = manager.addMask(400, 300);

      manager.moveMask(mask.id, -1000, -1000);

      const movedMask = manager.getMasks().find(m => m.id === mask.id)!;
      expect(movedMask.rect.x).toBeGreaterThanOrEqual(0);
      expect(movedMask.rect.y).toBeGreaterThanOrEqual(0);
    });

    it('存在しないIDを指定した場合、何もしない', () => {
      const mask = manager.addMask(400, 300);
      const originalRect = { ...mask.rect };

      manager.moveMask('non-existent-id', 50, 30);

      const currentMask = manager.getMasks().find(m => m.id === mask.id)!;
      expect(currentMask.rect).toEqual(originalRect);
    });
  });

  describe('resizeMask', () => {
    it('マスクを新しいサイズにリサイズする', () => {
      const mask = manager.addMask(400, 300);

      manager.resizeMask(mask.id, { x: 300, y: 200, width: 200, height: 150 });

      const resizedMask = manager.getMasks().find(m => m.id === mask.id)!;
      expect(resizedMask.rect.width).toBe(200);
      expect(resizedMask.rect.height).toBe(150);
      expect(resizedMask.rect.x).toBe(300);
      expect(resizedMask.rect.y).toBe(200);
    });

    it('最小サイズ（20x20px）未満にはリサイズできない', () => {
      const mask = manager.addMask(400, 300);

      manager.resizeMask(mask.id, { x: 400, y: 300, width: 5, height: 5 });

      const resizedMask = manager.getMasks().find(m => m.id === mask.id)!;
      expect(resizedMask.rect.width).toBeGreaterThanOrEqual(20);
      expect(resizedMask.rect.height).toBeGreaterThanOrEqual(20);
    });

    it('画像境界を超えるリサイズはクランプされる', () => {
      const mask = manager.addMask(400, 300);

      manager.resizeMask(mask.id, { x: 700, y: 500, width: 200, height: 200 });

      const resizedMask = manager.getMasks().find(m => m.id === mask.id)!;
      expect(resizedMask.rect.x + resizedMask.rect.width).toBeLessThanOrEqual(imageWidth);
      expect(resizedMask.rect.y + resizedMask.rect.height).toBeLessThanOrEqual(imageHeight);
    });

    it('存在しないIDを指定した場合、何もしない', () => {
      const mask = manager.addMask(400, 300);
      const originalRect = { ...mask.rect };

      manager.resizeMask('non-existent-id', { x: 0, y: 0, width: 200, height: 200 });

      const currentMask = manager.getMasks().find(m => m.id === mask.id)!;
      expect(currentMask.rect).toEqual(originalRect);
    });
  });

  describe('selectMask / deselectAll', () => {
    it('指定IDのマスクを選択状態にする', () => {
      const mask = manager.addMask(400, 300);

      manager.selectMask(mask.id);

      expect(manager.getSelectedMask()).not.toBeNull();
      expect(manager.getSelectedMask()!.id).toBe(mask.id);
    });

    it('選択すると他のマスクの選択が解除される', () => {
      const mask1 = manager.addMask(100, 100);
      const mask2 = manager.addMask(200, 200);

      manager.selectMask(mask1.id);
      expect(manager.getMasks().find(m => m.id === mask1.id)!.selected).toBe(true);

      manager.selectMask(mask2.id);
      expect(manager.getMasks().find(m => m.id === mask1.id)!.selected).toBe(false);
      expect(manager.getMasks().find(m => m.id === mask2.id)!.selected).toBe(true);
    });

    it('deselectAll ですべての選択が解除される', () => {
      const mask1 = manager.addMask(100, 100);
      const mask2 = manager.addMask(200, 200);

      manager.selectMask(mask1.id);
      manager.deselectAll();

      expect(manager.getSelectedMask()).toBeNull();
      expect(manager.getMasks().every(m => !m.selected)).toBe(true);
    });

    it('マスクがない場合、getSelectedMask は null を返す', () => {
      expect(manager.getSelectedMask()).toBeNull();
    });
  });

  describe('undo', () => {
    it('追加操作をUndoするとマスクが削除される', () => {
      manager.addMask(400, 300);
      expect(manager.getMasks()).toHaveLength(1);

      manager.undo();
      expect(manager.getMasks()).toHaveLength(0);
    });

    it('削除操作をUndoするとマスクが復元される', () => {
      const mask = manager.addMask(400, 300);
      manager.removeMask(mask.id);
      expect(manager.getMasks()).toHaveLength(0);

      manager.undo();
      expect(manager.getMasks()).toHaveLength(1);
    });

    it('移動操作をUndoすると元の位置に戻る', () => {
      const mask = manager.addMask(400, 300);
      const originalRect = { ...mask.rect };

      manager.moveMask(mask.id, 100, 50);
      manager.undo();

      const restoredMask = manager.getMasks().find(m => m.id === mask.id)!;
      expect(restoredMask.rect).toEqual(originalRect);
    });

    it('リサイズ操作をUndoすると元のサイズに戻る', () => {
      const mask = manager.addMask(400, 300);
      const originalRect = { ...mask.rect };

      manager.resizeMask(mask.id, { x: 300, y: 200, width: 200, height: 150 });
      manager.undo();

      const restoredMask = manager.getMasks().find(m => m.id === mask.id)!;
      expect(restoredMask.rect).toEqual(originalRect);
    });

    it('最大10回までUndoできる', () => {
      // 12回マスクを追加
      for (let i = 0; i < 12; i++) {
        manager.addMask(100 + i * 10, 100 + i * 10);
      }

      expect(manager.getMasks()).toHaveLength(12);

      // 10回Undoできる
      for (let i = 0; i < 10; i++) {
        expect(manager.canUndo()).toBe(true);
        manager.undo();
      }

      // 11回目はUndoできない
      expect(manager.canUndo()).toBe(false);
      expect(manager.getMasks()).toHaveLength(2);
    });

    it('履歴がない場合、undo は何もしない', () => {
      expect(manager.canUndo()).toBe(false);
      manager.undo(); // エラーが発生しないことを確認
      expect(manager.getMasks()).toHaveLength(0);
    });

    it('canUndo は履歴がある場合 true を返す', () => {
      expect(manager.canUndo()).toBe(false);

      manager.addMask(400, 300);
      expect(manager.canUndo()).toBe(true);
    });

    it('Undo後に選択状態がクリアされる', () => {
      const mask = manager.addMask(400, 300);
      manager.selectMask(mask.id);
      expect(manager.getSelectedMask()).not.toBeNull();

      manager.undo();
      expect(manager.getSelectedMask()).toBeNull();
    });
  });

  describe('境界条件', () => {
    it('非常に小さい画像（20x20px）でもマスクを追加できる', () => {
      const smallManager = new MaskManager(20, 20);
      const mask = smallManager.addMask(10, 10);

      expect(mask.rect.width).toBeGreaterThanOrEqual(20);
      expect(mask.rect.height).toBeGreaterThanOrEqual(20);
      expect(mask.rect.x).toBeGreaterThanOrEqual(0);
      expect(mask.rect.y).toBeGreaterThanOrEqual(0);
      expect(mask.rect.x + mask.rect.width).toBeLessThanOrEqual(20);
      expect(mask.rect.y + mask.rect.height).toBeLessThanOrEqual(20);
    });

    it('画像の端（0,0）にマスクを追加できる', () => {
      const mask = manager.addMask(0, 0);

      expect(mask.rect.x).toBeGreaterThanOrEqual(0);
      expect(mask.rect.y).toBeGreaterThanOrEqual(0);
    });

    it('画像の端（imageWidth, imageHeight）にマスクを追加できる', () => {
      const mask = manager.addMask(imageWidth, imageHeight);

      expect(mask.rect.x + mask.rect.width).toBeLessThanOrEqual(imageWidth);
      expect(mask.rect.y + mask.rect.height).toBeLessThanOrEqual(imageHeight);
    });
  });
});
