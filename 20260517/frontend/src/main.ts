/**
 * PrivacyLens Nova - メインエントリーポイント
 *
 * アプリケーション全体の初期化、イベントハンドリング、
 * 画面遷移、i18n（日本語/英語）を統括する。
 */

import { UIController } from './ui-controller';
import { ApiClient } from './api-client';
import { MaskManager } from './mask-manager';
import { MaskRenderer } from './mask-renderer';
import { ZoomManager } from './zoom-manager';
import { TouchHandler, TouchCallbacks } from './touch-handler';
import { processImage } from './image-processor';
import { convertBoundingBox } from './coordinate-converter';
import { generateFilename, downloadImage, copyToClipboard, shareImage, openXIntent } from './share-manager';
import type { BlurLevel, Mask } from './types';

// ===== API設定 =====
const API_BASE_URL = 'https://p3ltrzcoyrgjar7r7dg2qmz33m0jelea.lambda-url.us-east-1.on.aws';

// ===== i18n =====
type Lang = 'ja' | 'en';
let currentLang: Lang = 'ja';

const messages: Record<Lang, Record<string, string>> = {
  ja: {
    subtitle: '顔を自動検出してぼかしマスクを適用',
    tapToSelect: 'タップして写真を選択',
    processingImage: '画像を処理中...',
    detectingFaces: '顔を検出中...',
    retrying: '再試行中...',
    exporting: '画像を書き出し中...',
    saved: '画像を保存しました',
    shared: '共有しました',
    clipboardCopied: 'クリップボードにコピーしました。Xアプリに貼り付けてください',
    noFaces: '顔が検出されませんでした。手動でマスクを追加できます',
    saveFirst: '画像を保存してからXアプリで投稿してください',
    saveFailed: '保存に失敗しました。再試行してください',
    genericError: 'エラーが発生しました。再試行してください',
    editTitle: 'マスク編集',
    shareTitle: '保存・共有',
    blurLow: '弱',
    blurMedium: '中',
    blurHigh: '強',
    done: '完了',
    saveImage: '画像を保存',
    postX: 'Xに投稿',
    backEdit: '← 編集に戻る',
    retry: '再試行',
    close: '閉じる',
    resizeLabel: 'サイズ調整:',
    credit: 'Amazon Novaの物体検出を活用しました。',
  },
  en: {
    subtitle: 'Auto-detect faces and apply blur masks',
    tapToSelect: 'Tap to select a photo',
    processingImage: 'Processing image...',
    detectingFaces: 'Detecting faces...',
    retrying: 'Retrying...',
    exporting: 'Exporting image...',
    saved: 'Image saved',
    shared: 'Shared successfully',
    clipboardCopied: 'Copied to clipboard. Paste it in the X app',
    noFaces: 'No faces detected. You can add masks manually',
    saveFirst: 'Save the image first, then post from the X app',
    saveFailed: 'Save failed. Please retry',
    genericError: 'An error occurred. Please retry',
    editTitle: 'Edit Masks',
    shareTitle: 'Save & Share',
    blurLow: 'Low',
    blurMedium: 'Mid',
    blurHigh: 'High',
    done: 'Done',
    saveImage: 'Save Image',
    postX: 'Post to X',
    backEdit: '← Back to Edit',
    retry: 'Retry',
    close: 'Close',
    resizeLabel: 'Resize:',
    credit: 'I utilized object detection in Amazon Nova.',
  },
};

/** 翻訳関数 */
function t(key: string): string {
  return messages[currentLang][key] ?? key;
}

/** data-i18n属性を持つ全DOM要素とボタンテキストを更新する */
function updateLanguageUI(): void {
  // data-i18n属性を持つ要素を更新
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  });

  // 言語切替ボタン: 現在jaなら"EN"、enなら"JA"を表示
  const btnLang = document.getElementById('btn-lang');
  if (btnLang) {
    btnLang.textContent = currentLang === 'ja' ? 'EN' : 'JA';
  }

  // ぼかしボタンのテキスト更新
  document.querySelectorAll('[data-blur]').forEach((el) => {
    const level = el.getAttribute('data-blur');
    if (level === 'low') el.textContent = t('blurLow');
    if (level === 'medium') el.textContent = t('blurMedium');
    if (level === 'high') el.textContent = t('blurHigh');
  });

  // 各種ボタンテキスト更新
  const btnToShare = document.getElementById('btn-to-share');
  if (btnToShare) btnToShare.textContent = t('done');

  const btnBackEdit = document.getElementById('btn-back-edit');
  if (btnBackEdit) btnBackEdit.textContent = t('backEdit');

  const btnErrorRetry = document.getElementById('btn-error-retry');
  if (btnErrorRetry) btnErrorRetry.textContent = t('retry');

  const btnErrorClose = document.getElementById('btn-error-close');
  if (btnErrorClose) btnErrorClose.textContent = t('close');

  // リサイズラベル
  const resizeControls = document.getElementById('resize-controls');
  if (resizeControls) {
    const label = resizeControls.querySelector('.resize-label');
    if (label) label.textContent = t('resizeLabel');
  }
}

// ===== DOM要素取得 =====
function getElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el as T;
}

// ===== アプリケーション初期化 =====
function initApp(): void {
  // DOM要素
  const screenUpload = getElement<HTMLElement>('screen-upload');
  const screenEdit = getElement<HTMLElement>('screen-edit');
  const screenShare = getElement<HTMLElement>('screen-share');
  const btnLang = getElement<HTMLButtonElement>('btn-lang');
  const fileInput = getElement<HTMLInputElement>('file-input');
  const maskCanvas = getElement<HTMLCanvasElement>('mask-canvas');
  const shareCanvas = getElement<HTMLCanvasElement>('share-canvas');
  const btnUndo = getElement<HTMLButtonElement>('btn-undo');
  const btnDeleteMask = getElement<HTMLButtonElement>('btn-delete-mask');
  const btnAddMask = getElement<HTMLButtonElement>('btn-add-mask');
  const btnShrink = getElement<HTMLButtonElement>('btn-shrink');
  const btnGrow = getElement<HTMLButtonElement>('btn-grow');
  const resizeControls = getElement<HTMLElement>('resize-controls');
  const btnToShare = getElement<HTMLButtonElement>('btn-to-share');
  const btnDownload = getElement<HTMLButtonElement>('btn-download');
  const btnPostX = getElement<HTMLButtonElement>('btn-post-x');
  const btnBackEdit = getElement<HTMLButtonElement>('btn-back-edit');
  const errorOverlay = getElement<HTMLElement>('error-overlay');
  const errorMessage = getElement<HTMLElement>('error-message');
  const btnErrorRetry = getElement<HTMLButtonElement>('btn-error-retry');
  const btnErrorClose = getElement<HTMLButtonElement>('btn-error-close');
  const notificationToast = getElement<HTMLElement>('notification-toast');
  const notificationMessage = getElement<HTMLElement>('notification-message');
  const loadingOverlay = getElement<HTMLElement>('loading-overlay');
  const loadingText = getElement<HTMLElement>('loading-text');
  const previewPlaceholder = getElement<HTMLElement>('preview-placeholder');

  // コンポーネント初期化
  const uiController = new UIController();
  const apiClient = new ApiClient(API_BASE_URL);
  const maskRenderer = new MaskRenderer();
  const zoomManager = new ZoomManager();

  // 状態
  let maskManager: MaskManager | null = null;
  let touchHandler: TouchHandler | null = null;
  let currentBlurLevel: BlurLevel = 'medium';
  let imageElement: HTMLImageElement | null = null;
  let exportedBlob: Blob | null = null;
  let filename: string = '';
  let retryAction: (() => void) | null = null;

  // PC用マウスイベント状態
  let isDragging = false;
  let isResizing = false;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let resizeCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null = null;

  // ===== 画面遷移 =====
  function showScreen(screen: 'upload' | 'edit' | 'share'): void {
    screenUpload.hidden = screen !== 'upload';
    screenEdit.hidden = screen !== 'edit';
    screenShare.hidden = screen !== 'share';
    screenUpload.classList.toggle('active', screen === 'upload');
    screenEdit.classList.toggle('active', screen === 'edit');
    screenShare.classList.toggle('active', screen === 'share');
    uiController.setScreen(screen);
  }

  // ===== ローディング表示 =====
  function showLoading(text: string): void {
    loadingText.textContent = text;
    loadingOverlay.hidden = false;
    uiController.setLoading(true);
  }

  function hideLoading(): void {
    loadingOverlay.hidden = true;
    uiController.setLoading(false);
  }

  // ===== エラー表示 =====
  function showError(message: string, retry?: () => void): void {
    errorMessage.textContent = message;
    retryAction = retry ?? null;
    btnErrorRetry.hidden = !retry;
    errorOverlay.hidden = false;
    uiController.showError(message, retry);
  }

  function hideError(): void {
    errorOverlay.hidden = true;
    retryAction = null;
    uiController.hideError();
  }

  // ===== 通知表示 =====
  let notificationTimer: ReturnType<typeof setTimeout> | null = null;

  function showNotification(message: string): void {
    if (notificationTimer) {
      clearTimeout(notificationTimer);
    }
    notificationMessage.textContent = message;
    notificationToast.hidden = false;
    notificationTimer = setTimeout(() => {
      notificationToast.hidden = true;
      notificationTimer = null;
    }, 3000);
  }

  // ===== マスク描画更新 =====
  function updateRender(): void {
    if (!maskManager) return;
    const masks = maskManager.getMasks();
    maskRenderer.render(masks, currentBlurLevel, zoomManager.getZoom());
    updateEditButtons();
  }

  // ===== 編集ボタン状態更新 =====
  function updateEditButtons(): void {
    if (!maskManager) return;
    btnUndo.disabled = !maskManager.canUndo();
    const selected = maskManager.getSelectedMask();
    btnDeleteMask.disabled = !selected;
    resizeControls.hidden = !selected;
  }

  // ===== ファイルアップロード処理 =====
  async function handleFileUpload(file: File): Promise<void> {
    try {
      // 画像処理
      showLoading(t('processingImage'));
      const processed = await processImage(file);

      // 画像要素を作成
      imageElement = new Image();
      imageElement.src = `data:image/png;base64,${processed.base64}`;
      await new Promise<void>((resolve, reject) => {
        imageElement!.onload = () => resolve();
        imageElement!.onerror = () => reject(new Error('画像の読み込みに失敗'));
      });

      // プレビュー非表示
      previewPlaceholder.hidden = true;

      // 顔検出API呼び出し
      showLoading(t('detectingFaces'));
      const result = await apiClient.detectFaces(processed.base64);

      hideLoading();

      if (!result.success) {
        showError(result.error ?? t('genericError'), async () => {
          showLoading(t('retrying'));
          const retryResult = await apiClient.retry();
          hideLoading();
          if (retryResult.success) {
            initEditScreen(retryResult.faces ?? [], processed.width, processed.height);
          } else {
            showError(retryResult.error ?? t('genericError'));
          }
        });
        return;
      }

      // filenameをAPIレスポンスから取得
      filename = result.filename ?? '';

      // ログ表示
      showLog(
        result.faceCount ?? 0,
        result.processingTime ?? 0,
        result.inputTokens,
        result.outputTokens,
        result.cost
      );

      // 編集画面へ遷移
      initEditScreen(result.faces ?? [], processed.width, processed.height);

      // 顔が検出されなかった場合の通知
      if (!result.faces || result.faces.length === 0) {
        showNotification(t('noFaces'));
      }
    } catch (err: unknown) {
      hideLoading();
      const msg = err instanceof Error ? err.message : t('genericError');
      showError(msg);
    }
  }

  // ===== 編集画面初期化 =====
  function initEditScreen(faces: Array<{ x1: number; y1: number; x2: number; y2: number }>, imageWidth: number, imageHeight: number): void {
    if (!imageElement) return;

    // MaskRenderer初期化
    maskRenderer.initialize(maskCanvas, imageElement);

    // MaskManager初期化
    maskManager = new MaskManager(imageWidth, imageHeight);

    // 検出された顔からマスクを生成
    for (const face of faces) {
      const rect = convertBoundingBox(face, imageWidth, imageHeight);
      maskManager.addMask(rect.x + rect.width / 2, rect.y + rect.height / 2);
      // addMaskはデフォルトサイズなので、検出サイズに合わせてリサイズ
      const masks = maskManager.getMasks();
      const lastMask = masks[masks.length - 1];
      if (lastMask) {
        maskManager.resizeMask(lastMask.id, rect);
      }
    }

    // TouchHandler初期化
    if (touchHandler) {
      touchHandler.destroy();
    }

    const touchCallbacks: TouchCallbacks = {
      onMaskTap(x: number, y: number) {
        handleTap(x, y);
      },
      onMaskDragStart(_x: number, _y: number) {
        // ドラッグ開始
      },
      onMaskDrag(deltaX: number, deltaY: number) {
        if (!maskManager) return;
        const selected = maskManager.getSelectedMask();
        if (selected) {
          maskManager.moveMask(selected.id, deltaX, deltaY);
          updateRender();
        }
      },
      onMaskDragEnd() {
        // ドラッグ終了
      },
      onMaskResizeStart(_x: number, _y: number, _handle) {
        // リサイズ開始
      },
      onMaskResize(deltaX: number, deltaY: number) {
        if (!maskManager) return;
        const selected = maskManager.getSelectedMask();
        if (selected) {
          const newRect = {
            x: selected.rect.x,
            y: selected.rect.y,
            width: selected.rect.width + deltaX,
            height: selected.rect.height + deltaY,
          };
          maskManager.resizeMask(selected.id, newRect);
          updateRender();
        }
      },
      onMaskResizeEnd() {
        // リサイズ終了
      },
      onLongPress(x: number, y: number) {
        if (!maskManager) return;
        maskManager.addMask(x, y);
        updateRender();
      },
      onPinchZoom(scaleDelta: number) {
        const newZoom = zoomManager.getZoom() * scaleDelta;
        zoomManager.setZoom(newZoom);
        updateRender();
      },
    };

    touchHandler = new TouchHandler(maskCanvas, touchCallbacks);

    // PC用マウスイベント登録（タッチデバイスでは不要）
    if (!('ontouchstart' in window)) {
      setupMouseEvents();
    }

    // 画面遷移
    showScreen('edit');
    updateRender();
  }

  // ===== タップ/クリック処理 =====
  function handleTap(x: number, y: number): void {
    if (!maskManager) return;
    const masks = maskManager.getMasks();

    // タップ位置にあるマスクを検索
    let found = false;
    for (const mask of masks) {
      if (
        x >= mask.rect.x &&
        x <= mask.rect.x + mask.rect.width &&
        y >= mask.rect.y &&
        y <= mask.rect.y + mask.rect.height
      ) {
        maskManager.selectMask(mask.id);
        found = true;
        break;
      }
    }

    if (!found) {
      maskManager.deselectAll();
    }

    updateRender();
  }

  // ===== PC用マウスイベント =====
  function setupMouseEvents(): void {
    maskCanvas.addEventListener('mousedown', onMouseDown);
    maskCanvas.addEventListener('mousemove', onMouseMove);
    maskCanvas.addEventListener('mouseup', onMouseUp);
    maskCanvas.addEventListener('dblclick', onDoubleClick);
  }

  function getCanvasCoords(e: MouseEvent): { x: number; y: number } {
    const rect = maskCanvas.getBoundingClientRect();
    const scaleX = maskCanvas.width / rect.width;
    const scaleY = maskCanvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  /** リサイズハンドル（角）の当たり判定 */
  function getResizeHandle(x: number, y: number, mask: Mask): 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null {
    const handleSize = 16;
    const r = mask.rect;

    // 左上
    if (Math.abs(x - r.x) < handleSize && Math.abs(y - r.y) < handleSize) return 'top-left';
    // 右上
    if (Math.abs(x - (r.x + r.width)) < handleSize && Math.abs(y - r.y) < handleSize) return 'top-right';
    // 左下
    if (Math.abs(x - r.x) < handleSize && Math.abs(y - (r.y + r.height)) < handleSize) return 'bottom-left';
    // 右下
    if (Math.abs(x - (r.x + r.width)) < handleSize && Math.abs(y - (r.y + r.height)) < handleSize) return 'bottom-right';

    return null;
  }

  function onMouseDown(e: MouseEvent): void {
    if (!maskManager) return;
    const { x, y } = getCanvasCoords(e);
    lastMouseX = x;
    lastMouseY = y;

    const selected = maskManager.getSelectedMask();

    // 選択中マスクの角ドラッグ判定
    if (selected) {
      const handle = getResizeHandle(x, y, selected);
      if (handle) {
        isResizing = true;
        resizeCorner = handle;
        return;
      }
    }

    // マスク上のクリック → ドラッグ移動開始
    const masks = maskManager.getMasks();
    for (const mask of masks) {
      if (
        x >= mask.rect.x &&
        x <= mask.rect.x + mask.rect.width &&
        y >= mask.rect.y &&
        y <= mask.rect.y + mask.rect.height
      ) {
        maskManager.selectMask(mask.id);
        isDragging = true;
        updateRender();
        return;
      }
    }

    // 何もない場所をクリック → 選択解除
    maskManager.deselectAll();
    updateRender();
  }

  function onMouseMove(e: MouseEvent): void {
    if (!maskManager) return;
    const { x, y } = getCanvasCoords(e);
    const deltaX = x - lastMouseX;
    const deltaY = y - lastMouseY;
    lastMouseX = x;
    lastMouseY = y;

    if (isDragging) {
      const selected = maskManager.getSelectedMask();
      if (selected) {
        maskManager.moveMask(selected.id, deltaX, deltaY);
        updateRender();
      }
    }

    if (isResizing && resizeCorner) {
      const selected = maskManager.getSelectedMask();
      if (selected) {
        const r = selected.rect;
        let newRect = { ...r };

        switch (resizeCorner) {
          case 'top-left':
            newRect = { x: r.x + deltaX, y: r.y + deltaY, width: r.width - deltaX, height: r.height - deltaY };
            break;
          case 'top-right':
            newRect = { x: r.x, y: r.y + deltaY, width: r.width + deltaX, height: r.height - deltaY };
            break;
          case 'bottom-left':
            newRect = { x: r.x + deltaX, y: r.y, width: r.width - deltaX, height: r.height + deltaY };
            break;
          case 'bottom-right':
            newRect = { x: r.x, y: r.y, width: r.width + deltaX, height: r.height + deltaY };
            break;
        }

        maskManager.resizeMask(selected.id, newRect);
        updateRender();
      }
    }
  }

  function onMouseUp(_e: MouseEvent): void {
    isDragging = false;
    isResizing = false;
    resizeCorner = null;
  }

  /** ダブルクリックでマスク追加 */
  function onDoubleClick(e: MouseEvent): void {
    if (!maskManager) return;
    const { x, y } = getCanvasCoords(e);
    maskManager.addMask(x, y);
    updateRender();
  }

  // ===== ぼかし強度変更 =====
  document.querySelectorAll('[data-blur]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const level = btn.getAttribute('data-blur') as BlurLevel;
      if (!level) return;
      currentBlurLevel = level;

      // ボタンのアクティブ状態を更新
      document.querySelectorAll('[data-blur]').forEach((b) => {
        b.classList.remove('btn--blur-active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('btn--blur-active');
      btn.setAttribute('aria-pressed', 'true');

      updateRender();
    });
  });

  // ===== 編集ツールバーボタン =====
  btnUndo.addEventListener('click', () => {
    if (!maskManager) return;
    maskManager.undo();
    updateRender();
  });

  btnDeleteMask.addEventListener('click', () => {
    if (!maskManager) return;
    const selected = maskManager.getSelectedMask();
    if (selected) {
      maskManager.removeMask(selected.id);
      updateRender();
    }
  });

  btnAddMask.addEventListener('click', () => {
    if (!maskManager || !maskCanvas) return;
    // キャンバス中央にマスクを追加
    const centerX = maskCanvas.width / 2;
    const centerY = maskCanvas.height / 2;
    maskManager.addMask(centerX, centerY);
    updateRender();
  });

  btnShrink.addEventListener('click', () => {
    if (!maskManager) return;
    const selected = maskManager.getSelectedMask();
    if (selected) {
      const r = selected.rect;
      const shrinkAmount = 10;
      const newRect = {
        x: r.x + shrinkAmount,
        y: r.y + shrinkAmount,
        width: r.width - shrinkAmount * 2,
        height: r.height - shrinkAmount * 2,
      };
      maskManager.resizeMask(selected.id, newRect);
      updateRender();
    }
  });

  btnGrow.addEventListener('click', () => {
    if (!maskManager) return;
    const selected = maskManager.getSelectedMask();
    if (selected) {
      const r = selected.rect;
      const growAmount = 10;
      const newRect = {
        x: r.x - growAmount,
        y: r.y - growAmount,
        width: r.width + growAmount * 2,
        height: r.height + growAmount * 2,
      };
      maskManager.resizeMask(selected.id, newRect);
      updateRender();
    }
  });

  // ===== 共有画面遷移 =====
  btnToShare.addEventListener('click', async () => {
    if (!maskManager) return;
    try {
      showLoading(t('exporting'));
      const masks = maskManager.getMasks();
      exportedBlob = await maskRenderer.exportImage(masks, currentBlurLevel);
      hideLoading();

      // 共有キャンバスにプレビュー描画
      const shareCtx = shareCanvas.getContext('2d');
      if (shareCtx && exportedBlob) {
        const img = new Image();
        const url = URL.createObjectURL(exportedBlob);
        img.onload = () => {
          shareCanvas.width = img.naturalWidth;
          shareCanvas.height = img.naturalHeight;
          shareCtx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
        };
        img.src = url;
      }

      showScreen('share');
    } catch (err: unknown) {
      hideLoading();
      const msg = err instanceof Error ? err.message : t('genericError');
      showError(msg);
    }
  });

  // ===== ダウンロード =====
  btnDownload.addEventListener('click', async () => {
    if (!exportedBlob) {
      showError(t('saveFailed'));
      return;
    }
    try {
      const fname = filename || generateFilename();
      await downloadImage(exportedBlob, fname);
      showNotification(t('saved'));
    } catch {
      showError(t('saveFailed'));
    }
  });

  // ===== X投稿 =====
  btnPostX.addEventListener('click', async () => {
    if (!exportedBlob) {
      showError(t('saveFirst'));
      return;
    }

    // モバイル判定: タッチ対応 + 画面幅768px以下
    const isMobile = 'ontouchstart' in window && window.innerWidth <= 768;

    if (isMobile) {
      // モバイル: Web Share API
      const shared = await shareImage(exportedBlob, '#PrivacyLensNova');
      if (shared) {
        showNotification(t('shared'));
      } else {
        // Web Share APIが使えない場合はフォールバック
        openXIntent('', 'PrivacyLensNova');
      }
    } else {
      // PC: クリップボードにコピー + WebIntent
      const copied = await copyToClipboard(exportedBlob);
      if (copied) {
        showNotification(t('clipboardCopied'));
      }
      openXIntent('', 'PrivacyLensNova');
    }
  });

  // ===== 編集に戻る =====
  btnBackEdit.addEventListener('click', () => {
    exportedBlob = null;
    showScreen('edit');
  });

  // ===== エラーオーバーレイ =====
  btnErrorRetry.addEventListener('click', () => {
    hideError();
    if (retryAction) {
      retryAction();
    }
  });

  btnErrorClose.addEventListener('click', () => {
    hideError();
  });

  // ===== ファイル入力 =====
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  });

  // ===== 言語切替 =====
  btnLang.addEventListener('click', () => {
    currentLang = currentLang === 'ja' ? 'en' : 'ja';
    updateLanguageUI();
  });

  // ===== ログボタン =====
  const logSection = document.getElementById('log-section');
  const btnLog = document.getElementById('btn-log');
  const logContent = document.getElementById('log-content');
  const logFaces = document.getElementById('log-faces');
  const logTime = document.getElementById('log-time');

  if (btnLog && logContent) {
    btnLog.addEventListener('click', () => {
      logContent.hidden = !logContent.hidden;
    });
  }

  /** ログセクションを表示してデータを設定する */
  function showLog(faceCount: number, processingTime: number, inputTokens?: number, outputTokens?: number, cost?: number): void {
    if (logSection) logSection.hidden = false;
    if (logFaces) logFaces.textContent = String(faceCount);
    if (logTime) logTime.textContent = (processingTime / 1000).toFixed(2);
    const logTokens = document.getElementById('log-tokens');
    const logCost = document.getElementById('log-cost');
    if (logTokens) logTokens.textContent = `${inputTokens ?? 0} input / ${outputTokens ?? 0} output`;
    if (logCost) logCost.textContent = (cost ?? 0).toFixed(6);
  }

  // ===== 初期UI更新 =====
  updateLanguageUI();

  // PC判定: 画面幅769px以上ならQRコード表示
  const qrCode = document.getElementById('qr-code');
  if (qrCode && window.innerWidth > 768) {
    qrCode.hidden = false;
  }
}

// ===== DOMContentLoaded =====
document.addEventListener('DOMContentLoaded', initApp);
