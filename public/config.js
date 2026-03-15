// PrivacyLens Nova - API Configuration
// API Gateway endpoints

export const config = {
  endpoints: {
    rekognition: 'https://5naz1rt97b.execute-api.us-east-1.amazonaws.com/prod/rekognition',
    novaLite: 'https://5naz1rt97b.execute-api.us-east-1.amazonaws.com/prod/nova-lite',
    novaPro: 'https://5naz1rt97b.execute-api.us-east-1.amazonaws.com/prod/nova-pro',
    novaPremier: 'https://5naz1rt97b.execute-api.us-east-1.amazonaws.com/prod/nova-premier'
  },
  
  // Dummy function for compatibility
  async loadFromAmplify() {
    // Endpoints are already configured above
    console.log('Using pre-configured API Gateway endpoints');
  }
};
