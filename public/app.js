// PrivacyLens Nova - メインアプリケーションロジック
import { initI18n, toggleLanguage, t } from './i18n.js';
import { config } from './config.js';
import { initCanvas, renderResults, downloadImage } from './canvas-renderer.js';

// グローバル変数
let selectedImage = null;
let base64Image = null;
let currentResults = null;

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  console.log('PrivacyLens Nova initialized');
  
  // i18n初期化
  initI18n();
  
  // Canvas初期化
  initCanvas();
  
  // イベントリスナーの設定
  document.getElementById('imageInput').addEventListener('change', handleImageUpload);
  document.getElementById('languageToggle').addEventListener('click', handleLanguageToggle);
  
  // サービスボタンのイベントリスナー
  document.getElementById('rekognitionBtn').addEventListener('click', () => detectFaces('rekognition'));
  document.getElementById('novaLiteBtn').addEventListener('click', () => detectFaces('novaLite'));
  document.getElementById('novaProBtn').addEventListener('click', () => detectFaces('novaPro'));
  document.getElementById('novaPremierBtn').addEventListener('click', () => detectFaces('novaPremier'));
});


// 画像アップロード処理
async function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  console.log('Image selected:', file.name, file.size);
  
  // ファイル情報を表示
  document.getElementById('fileInfo').innerHTML = `
    <p><strong>File:</strong> ${file.name}</p>
    <p><strong>Size:</strong> ${(file.size / 1024).toFixed(2)} KB</p>
  `;
  
  // 画像プレビューを表示
  const previewImage = document.getElementById('previewImage');
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImage.src = e.target.result;
    previewImage.style.display = 'block';
  };
  reader.readAsDataURL(file);
  
  // 画像をリサイズしてBase64エンコード
  try {
    const result = await resizeAndEncodeImage(file);
    base64Image = result.base64;
    selectedImage = result.dataUrl;
    console.log('Image encoded, size:', base64Image.length);
    
    // サービスボタンを有効化
    enableServiceButtons(true);
  } catch (error) {
    console.error('Error processing image:', error);
    showError(t('errorFormat'));
  }
}

// 画像のリサイズとBase64エンコード
function resizeAndEncodeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Canvasでリサイズ
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 最大サイズ1280px
        const maxSize = 1280;
        let width = img.width;
        let height = img.height;
        
        if (width > height && width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        // Base64エンコード（JPEG 85%品質）
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const base64 = dataUrl.split(',')[1];
        
        // サイズチェック（5MB制限）
        if (base64.length > 5 * 1024 * 1024) {
          reject(new Error(t('errorSize')));
        } else {
          resolve({ base64, dataUrl });
        }
      };
      
      img.onerror = () => reject(new Error(t('errorFormat')));
      img.src = e.target.result;
    };
    
    reader.onerror = () => reject(new Error(t('errorFormat')));
    reader.readAsDataURL(file);
  });
}


// サービスボタンの有効化/無効化
function enableServiceButtons(enabled) {
  document.getElementById('rekognitionBtn').disabled = !enabled;
  document.getElementById('novaLiteBtn').disabled = !enabled;
  document.getElementById('novaProBtn').disabled = !enabled;
  document.getElementById('novaPremierBtn').disabled = !enabled;
}

// 顔検出処理
async function detectFaces(service) {
  console.log('Detecting faces with:', service);
  
  if (!base64Image) {
    showError('画像が選択されていません');
    return;
  }
  
  // ローディング表示
  showLoading(true);
  
  const startTime = Date.now();
  
  try {
    // Lambda Function URLへのリクエスト
    const endpoint = config.endpoints[service];
    
    if (!endpoint || endpoint.includes('YOUR_')) {
      throw new Error('エンドポイントが設定されていません。設定パネルでLambda Function URLを設定してください。');
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ image: base64Image })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    const result = await response.json();
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('Detection result:', result);
    
    // 結果を保存
    currentResults = result;
    
    // 結果を表示
    await displayResults(result, elapsedTime);
    
  } catch (error) {
    console.error('Detection error:', error);
    showError(error.message);
  } finally {
    showLoading(false);
  }
}

// 結果表示
async function displayResults(result, elapsedTime) {
  // 結果セクションを表示
  document.getElementById('resultsSection').style.display = 'block';
  
  // Canvasに描画
  await renderResults(selectedImage, result);
  
  // 結果情報を表示
  let infoHtml = `
    <p><strong>${t('service')}:</strong> ${result.service}</p>
    <p><strong>${t('facesDetected')}:</strong> ${result.faceCount}</p>
    <p><strong>${t('processingTime')}:</strong> ${elapsedTime}s</p>
  `;
  
  // コスト情報
  if (result.cost) {
    infoHtml += `<p><strong>${t('cost')}:</strong> $${result.cost.estimatedCost.toFixed(6)} ${result.cost.currency}</p>`;
    
    if (result.cost.inputTokens) {
      infoHtml += `<p><strong>${t('tokens')}:</strong> ${result.cost.inputTokens} input / ${result.cost.outputTokens} output</p>`;
    }
  }
  
  // 処理枚数カウンター
  if (result.processedCount) {
    infoHtml += `<p><strong>${t('processedCount')}:</strong> 🖼️ ${result.processedCount} images processed | 💾 0 images stored</p>`;
    infoHtml += `<p><em>${t('privacyFirst')}</em></p>`;
  }
  
  document.getElementById('resultInfo').innerHTML = infoHtml;
}

// ローディング表示
function showLoading(show) {
  // TODO: ローディングインジケーターの実装
  if (show) {
    console.log('Loading...');
  } else {
    console.log('Loading complete');
  }
}

// エラー表示
function showError(message) {
  alert(message);
}

// 言語切り替え
function handleLanguageToggle() {
  const newLang = toggleLanguage();
  console.log('Language switched to:', newLang);
}


// モーダル関連の初期化（DOMContentLoadedに追加）
function initModals() {
  // 開発者情報モーダル
  const devModal = document.getElementById('developerModal');
  const devBtn = document.getElementById('developerInfo');
  const devClose = devModal.querySelector('.close');
  
  devBtn.onclick = () => devModal.style.display = 'block';
  devClose.onclick = () => devModal.style.display = 'none';
  
  // 設定モーダル
  const settingsModal = document.getElementById('settingsModal');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsClose = settingsModal.querySelector('.close');
  
  settingsBtn.onclick = () => {
    // 現在の設定を表示
    document.getElementById('rekognitionEndpoint').value = config.endpoints.rekognition;
    document.getElementById('novaLiteEndpoint').value = config.endpoints.novaLite;
    document.getElementById('novaProEndpoint').value = config.endpoints.novaPro;
    document.getElementById('novaPremierEndpoint').value = config.endpoints.novaPremier;
    settingsModal.style.display = 'block';
  };
  settingsClose.onclick = () => settingsModal.style.display = 'none';
  
  // 設定保存
  document.getElementById('saveSettingsBtn').onclick = () => {
    config.endpoints.rekognition = document.getElementById('rekognitionEndpoint').value;
    config.endpoints.novaLite = document.getElementById('novaLiteEndpoint').value;
    config.endpoints.novaPro = document.getElementById('novaProEndpoint').value;
    config.endpoints.novaPremier = document.getElementById('novaPremierEndpoint').value;
    config.saveToStorage();
    alert('設定を保存しました');
    settingsModal.style.display = 'none';
  };
  
  // モーダル外クリックで閉じる
  window.onclick = (event) => {
    if (event.target === devModal) devModal.style.display = 'none';
    if (event.target === settingsModal) settingsModal.style.display = 'none';
  };
  
  // ダウンロードボタン
  document.getElementById('downloadBtn').onclick = () => {
    downloadImage();
  };
  
  // X投稿ボタン
  document.getElementById('postToXBtn').onclick = () => {
    postToX();
  };
}

// X投稿機能
async function postToX() {
  try {
    const blob = await getCanvasBlob();
    const text = encodeURIComponent('PrivacyLens Novaで顔マスク処理しました！ #PrivacyLensNova #10000AIdeas #AmazonNova');
    
    // X Web Intent URL（画像は直接添付できないため、テキストのみ）
    const url = `https://twitter.com/intent/tweet?text=${text}`;
    window.open(url, '_blank');
  } catch (error) {
    console.error('X投稿エラー:', error);
    alert('X投稿機能は現在テキストのみ対応しています。画像は手動でアップロードしてください。');
  }
}

// DOMContentLoadedイベントに追加
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initModals);
} else {
  initModals();
}
