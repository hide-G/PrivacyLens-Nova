/**
 * ShareManager - 画像の保存とX投稿を管理するモジュール
 *
 * - downloadImage(): Canvas toBlob → ダウンロード（PNG形式、EXIFなし）
 * - copyToClipboard(): Clipboard API による画像コピー
 * - buildXIntentUrl(): X Web Intent URL生成
 * - openXIntent(): X Web Intent URL生成と新タブオープン
 */

/**
 * ユニークなファイル名を生成する
 * 形式: privacylens-nova-YYYYMMDD-HHmmss-XXXXXX.png
 *
 * @returns ユニークなファイル名
 */
export function generateFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const unique = Math.random().toString(36).substring(2, 8);

  return `privacylens-nova-${year}${month}${day}-${hours}${minutes}${seconds}-${unique}.png`;
}

/**
 * マスク適用済み画像をPNG形式でデバイスにダウンロードする。
 * EXIFメタデータは含まれない（Canvas toBlob由来のため）。
 *
 * @param blob - ダウンロードする画像のBlob
 * @param filename - ファイル名（省略時: privacylens-nova-{timestamp}.png）
 */
export function downloadImage(blob: Blob, filename?: string): void {
  const resolvedFilename = filename ?? `privacylens-nova-${Date.now()}.png`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = resolvedFilename;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();

  // クリーンアップ
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Clipboard API を使用して画像をクリップボードにコピーする。
 *
 * @param blob - コピーする画像のBlob
 * @returns コピー成功時 true、失敗時 false
 */
export async function copyToClipboard(blob: Blob): Promise<boolean> {
  try {
    const clipboardItem = new ClipboardItem({
      [blob.type]: blob,
    });
    await navigator.clipboard.write([clipboardItem]);
    return true;
  } catch {
    return false;
  }
}

/**
 * X Web Intent URL を生成する。
 *
 * @param text - 投稿テキスト（省略時: 空文字）
 * @param hashtags - ハッシュタグ（省略時: "PrivacyLensNova"）
 * @returns X Web Intent URL文字列
 */
export function buildXIntentUrl(text?: string, hashtags?: string): string {
  const resolvedText = text ?? '';
  const resolvedHashtags = hashtags ?? 'PrivacyLensNova';

  const params = new URLSearchParams();
  if (resolvedText) {
    params.set('text', resolvedText);
  }
  if (resolvedHashtags) {
    params.set('hashtags', resolvedHashtags);
  }

  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

/**
 * Web Share API を使用して画像を共有する。
 * スマホやモダンブラウザではXアプリに直接画像を共有できる。
 *
 * @param blob - 共有する画像のBlob
 * @param text - 共有テキスト（省略時: 空文字）
 * @returns 共有成功時 true、失敗またはキャンセル時 false
 */
export async function shareImage(blob: Blob, text?: string): Promise<boolean> {
  // Web Share API Level 2（ファイル共有）がサポートされているか確認
  if (!navigator.share || !navigator.canShare) {
    return false;
  }

  const file = new File([blob], 'privacylens-nova.png', { type: 'image/png' });
  const shareData: ShareData = {
    files: [file],
    text: text ?? '',
    hashtags: 'PrivacyLensNova',
  };

  // canShareでファイル共有がサポートされているか確認
  if (!navigator.canShare(shareData)) {
    return false;
  }

  try {
    await navigator.share(shareData);
    return true;
  } catch {
    // ユーザーがキャンセルした場合もfalseを返す
    return false;
  }
}

/**
 * X Web Intent URL を生成し、新しいタブで開く。
 *
 * @param text - 投稿テキスト（省略時: デフォルトテキスト）
 * @param hashtags - ハッシュタグ（省略時: "PrivacyLensNova"）
 */
export function openXIntent(text?: string, hashtags?: string): void {
  const url = buildXIntentUrl(text, hashtags);
  window.open(url, '_blank', 'noopener,noreferrer');
}
