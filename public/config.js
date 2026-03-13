// Lambda Function URL設定
// Amplify outputsから自動取得

export const config = {
  endpoints: {
    rekognition: '',
    novaLite: '',
    novaPro: '',
    novaPremier: ''
  },
  
  // Amplify outputsから設定を読み込む
  async loadFromAmplify() {
    try {
      // Amplify outputsファイルを読み込み
      const response = await fetch('/amplify_outputs.json');
      if (response.ok) {
        const outputs = await response.json();
        
        // Lambda Function URLを取得
        if (outputs.custom?.rekognitionFunctionUrl) {
          this.endpoints.rekognition = outputs.custom.rekognitionFunctionUrl;
        }
        if (outputs.custom?.novaLiteFunctionUrl) {
          this.endpoints.novaLite = outputs.custom.novaLiteFunctionUrl;
        }
        if (outputs.custom?.novaProFunctionUrl) {
          this.endpoints.novaPro = outputs.custom.novaProFunctionUrl;
        }
        if (outputs.custom?.novaPremierFunctionUrl) {
          this.endpoints.novaPremier = outputs.custom.novaPremierFunctionUrl;
        }
        
        console.log('Amplify outputs loaded:', this.endpoints);
      }
    } catch (e) {
      console.warn('Amplify outputsの読み込みに失敗しました:', e);
    }
  }
};

// 初期化時に設定を読み込む
config.loadFromAmplify();
