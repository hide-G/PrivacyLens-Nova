// API Gateway endpoint configuration
// Loaded from Amplify outputs

export const config = {
  endpoints: {
    rekognition: '',
    novaLite: '',
    novaPro: '',
    novaPremier: ''
  },
  
  // Load configuration from Amplify outputs
  async loadFromAmplify() {
    try {
      // Load Amplify outputs file
      const response = await fetch('/amplify_outputs.json');
      if (response.ok) {
        const outputs = await response.json();
        
        // Get API Gateway endpoint
        if (outputs.custom?.API?.PrivacyLensFaceDetectionApi) {
          const apiEndpoint = outputs.custom.API.PrivacyLensFaceDetectionApi.endpoint;
          this.endpoints.rekognition = apiEndpoint + 'rekognition';
          this.endpoints.novaLite = apiEndpoint + 'nova-lite';
          this.endpoints.novaPro = apiEndpoint + 'nova-pro';
          this.endpoints.novaPremier = apiEndpoint + 'nova-premier';
        }
        
        console.log('API Gateway endpoints loaded:', this.endpoints);
      }
    } catch (e) {
      console.warn('Failed to load Amplify outputs:', e);
    }
  }
};

// Load configuration on initialization
config.loadFromAmplify();
