// API Gateway Endpoint Configuration
// Automatically loaded from Amplify outputs

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
        if (outputs.custom?.API?.PrivacyLensFaceDetectionApi?.endpoint) {
          const baseUrl = outputs.custom.API.PrivacyLensFaceDetectionApi.endpoint;
          
          // Set endpoints for each service
          this.endpoints.rekognition = baseUrl + 'rekognition';
          this.endpoints.novaLite = baseUrl + 'nova-lite';
          this.endpoints.novaPro = baseUrl + 'nova-pro';
          this.endpoints.novaPremier = baseUrl + 'nova-premier';
          
          console.log('API Gateway endpoints loaded:', this.endpoints);
        } else {
          console.error('API Gateway endpoint not found in amplify_outputs.json');
        }
      }
    } catch (e) {
      console.error('Failed to load Amplify outputs:', e);
    }
    
    // Validate endpoints
    if (!this.endpoints.rekognition) {
      alert('Endpoint not configured. Lambda Function URL is not set.');
    }
  }
};

// Load configuration on initialization
config.loadFromAmplify();
