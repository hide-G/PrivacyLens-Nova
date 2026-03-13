// Lambda Function URL設定
// デプロイ後に実際のURLに更新してください

export const config = {
  endpoints: {
    rekognition: 'https://YOUR_REKOGNITION_FUNCTION_URL',
    novaLite: 'https://YOUR_NOVA_LITE_FUNCTION_URL',
    novaPro: 'https://YOUR_NOVA_PRO_FUNCTION_URL',
    novaPremier: 'https://YOUR_NOVA_PREMIER_FUNCTION_URL'
  },
  
  // LocalStorageから設定を読み込む
  loadFromStorage() {
    const saved = localStorage.getItem('lambdaEndpoints');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        Object.assign(this.endpoints, parsed);
      } catch (e) {
        console.error('設定の読み込みエラー:', e);
      }
    }
  },
  
  // LocalStorageに設定を保存
  saveToStorage() {
    localStorage.setItem('lambdaEndpoints', JSON.stringify(this.endpoints));
  }
};

// 初期化時に設定を読み込む
config.loadFromStorage();
