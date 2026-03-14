import { defineFunction } from '@aws-amplify/backend';

export const novaLiteFunction = defineFunction({
  name: 'nova-lite-detect-faces',
  entry: './handler.js',
  runtime: 20,
  timeoutSeconds: 60,
  memoryMB: 1024,
  environment: {
    COUNTER_TABLE_NAME: 'ProcessedCounter',
    NOVA_MODEL_ID: 'us.amazon.nova-lite-v1:0'
  }
});
