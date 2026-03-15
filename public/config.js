// PrivacyLens Nova - API Configuration
// Auto-generated on 2026-03-16 05:25:04

export const config = {
  endpoints: {
    rekognition: 'https://5naz1rt97b.execute-api.us-east-1.amazonaws.com/prod/rekognition',
    novaLite: 'https://5naz1rt97b.execute-api.us-east-1.amazonaws.com/prod/nova-lite',
    novaPro: 'https://5naz1rt97b.execute-api.us-east-1.amazonaws.com/prod/nova-pro',
    novaPremier: 'https://5naz1rt97b.execute-api.us-east-1.amazonaws.com/prod/nova-premier'
  },
  
  // Load endpoints from Amplify outputs (if available)
  async loadFromAmplify() {
    try {
      const { Amplify } = await import('aws-amplify');
      const outputs = Amplify.getConfig();
      
      if (outputs?.custom?.API) {
        const apiConfig = Object.values(outputs.custom.API)[0];
        if (apiConfig?.endpoint) {
          const baseUrl = apiConfig.endpoint.replace(/\/$/, '');
          this.endpoints.rekognition = `${baseUrl}/rekognition`;
          this.endpoints.novaLite = `${baseUrl}/nova-lite`;
          this.endpoints.novaPro = `${baseUrl}/nova-pro`;
          this.endpoints.novaPremier = `${baseUrl}/nova-premier`;
        }
      }
    } catch (error) {
      console.warn('Failed to load Amplify config, using default endpoints:', error);
    }
  }
};
