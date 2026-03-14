import { defineFunction } from '@aws-amplify/backend';

export const rekognitionFunction = defineFunction({
  name: 'rekognition-detect-faces',
  entry: './handler.js',
  runtime: 20,
  timeoutSeconds: 30,
  memoryMB: 512,
  environment: {
    COUNTER_TABLE_NAME: 'ProcessedCounter'
  }
});
