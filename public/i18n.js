// 多言語対応（i18n）モジュール

// 翻訳辞書
const translations = {
  en: {
    appTitle: "PrivacyLens Nova",
    uploadTitle: "Upload Image",
    selectService: "Select Detection Service",
    rekognition: "Rekognition",
    novaLite: "Nova Lite v2",
    novaPro: "Nova Pro v1",
    novaPremier: "Nova Premier v1",
    processing: "Processing...",
    results: "Results",
    facesDetected: "Faces Detected",
    masked: "Masked",
    unmasked: "Unmasked",
    downloadButton: "Download Image",
    postToX: "Post to X",
    developerInfo: "Developer",
    settings: "Settings",
    processingTime: "Processing Time",
    cost: "Cost",
    tokens: "Tokens",
    processedCount: "Images Processed",
    imagesStored: "Images Stored",
    privacyFirst: "Privacy First: No images stored",
    errorNetwork: "Network error. Please check your connection.",
    errorTimeout: "Request timeout. Please try again.",
    errorSize: "Image size exceeds 5MB limit.",
    errorFormat: "Unsupported image format. Please use JPEG, PNG, or WebP.",
    errorApi: "API error. Please try again later.",
    addMask: "Add Mask",
    deleteMask: "Delete Mask",
    undo: "Undo",
    redo: "Redo",
    finalize: "Finalize",
    reset: "Reset",
    instructions: "Instructions",
    clickToToggle: "Click/tap to toggle mask",
    longPressToDelete: "Long press/right-click to delete",
    dragToMove: "Drag to move mask",
    dragHandleToResize: "Drag handle to resize",
    maskStyle: "Mask Style",
    solidBlack: "Solid Black",
    blur: "Blur",
    pixelate: "Pixelate",
    emoji: "Emoji"
  },
  ja: {
    appTitle: "PrivacyLens Nova",
    uploadTitle: "画像をアップロード",
    selectService: "検出サービスを選択",
    rekognition: "Rekognition",
    novaLite: "Nova Lite v2",
    novaPro: "Nova Pro v1",
    novaPremier: "Nova Premier v1",
    processing: "処理中...",
    results: "結果",
    facesDetected: "検出された顔",
    masked: "マスク済み",
    unmasked: "マスクなし",
    downloadButton: "画像をダウンロード",
    postToX: "Xに投稿",
    developerInfo: "開発者情報",
    settings: "設定",
    processingTime: "処理時間",
    cost: "コスト",
    tokens: "トークン",
    processedCount: "処理枚数",
    imagesStored: "保存枚数",
    privacyFirst: "プライバシーファースト: 画像は保存されません",
    errorNetwork: "ネットワークエラーが発生しました。接続を確認してください。",
    errorTimeout: "リクエストがタイムアウトしました。再試行してください。",
    errorSize: "画像サイズが5MBを超えています。",
    errorFormat: "サポートされていない画像形式です。JPEG、PNG、WebPを使用してください。",
    errorApi: "APIエラーが発生しました。後でもう一度お試しください。",
    addMask: "マスクを追加",
    deleteMask: "マスクを削除",
    undo: "元に戻す",
    redo: "やり直し",
    finalize: "確定",
    reset: "リセット",
    instructions: "操作方法",
    clickToToggle: "クリック/タップでマスク切り替え",
    longPressToDelete: "長押し/右クリックで削除",
    dragToMove: "ドラッグで移動",
    dragHandleToResize: "ハンドルをドラッグでリサイズ",
    maskStyle: "マスクスタイル",
    solidBlack: "黒塗り",
    blur: "ぼかし",
    pixelate: "モザイク",
    emoji: "絵文字"
  }
};

// 現在の言語
let currentLanguage = 'en';

// 初期化
export function initI18n() {
  // LocalStorageから言語設定を復元
  const savedLanguage = localStorage.getItem('language');
  if (savedLanguage && translations[savedLanguage]) {
    currentLanguage = savedLanguage;
  }
  
  // UI更新
  updateUIText();
}

// 言語切り替え
export function toggleLanguage() {
  currentLanguage = currentLanguage === 'en' ? 'ja' : 'en';
  localStorage.setItem('language', currentLanguage);
  updateUIText();
  return currentLanguage;
}

// 現在の言語を取得
export function getCurrentLanguage() {
  return currentLanguage;
}

// 翻訳テキストを取得
export function t(key) {
  return translations[currentLanguage][key] || key;
}

// UI言語の更新
function updateUIText() {
  // data-i18n属性を持つ要素を更新
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    const text = t(key);
    if (text) {
      element.textContent = text;
    }
  });
  
  // 言語切り替えボタンのラベル更新
  const languageToggle = document.getElementById('languageToggle');
  if (languageToggle) {
    languageToggle.textContent = currentLanguage === 'en' ? '日本語' : 'English';
  }
}
