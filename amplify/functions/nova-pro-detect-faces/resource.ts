import { defineFunction } from '@aws-amplify/backend';

export const novaProFunction = defineFunction({
  name: 'nova-pro-detect-faces',
  entry: './handler.js',
  runtime: 20,
  timeoutSeconds: 60,
  memoryMB: 1024,
  environment: {
    COUNTER_TABLE_NAME: 'ProcessedCounter',
    NOVA_MODEL_ID: 'amazon.nova-pro-v1:0'
  }
});
