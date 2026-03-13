import { defineBackend } from '@aws-amplify/backend';
import { defineFunction } from '@aws-amplify/backend-function';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import { RemovalPolicy } from 'aws-cdk-lib';

// Lambda関数の定義
const rekognitionFunction = defineFunction({
  name: 'rekognition-detect-faces',
  entry: './functions/rekognition-detect-faces/handler.js',
  runtime: 20,
  timeoutSeconds: 30,
  memoryMB: 512,
  environment: {
    COUNTER_TABLE_NAME: 'ProcessedCounter'
  }
});

const novaLiteFunction = defineFunction({
  name: 'nova-lite-detect-faces',
  entry: './functions/nova-lite-detect-faces/handler.js',
  runtime: 20,
  timeoutSeconds: 60,
  memoryMB: 1024,
  environment: {
    COUNTER_TABLE_NAME: 'ProcessedCounter',
    NOVA_MODEL_ID: 'us.amazon.nova-lite-v1:0'
  }
});

const novaProFunction = defineFunction({
  name: 'nova-pro-detect-faces',
  entry: './functions/nova-pro-detect-faces/handler.js',
  runtime: 20,
  timeoutSeconds: 60,
  memoryMB: 1024,
  environment: {
    COUNTER_TABLE_NAME: 'ProcessedCounter',
    NOVA_MODEL_ID: 'amazon.nova-pro-v1:0'
  }
});

const novaPremierFunction = defineFunction({
  name: 'nova-premier-detect-faces',
  entry: './functions/nova-premier-detect-faces/handler.js',
  runtime: 20,
  timeoutSeconds: 60,
  memoryMB: 1024,
  environment: {
    COUNTER_TABLE_NAME: 'ProcessedCounter',
    NOVA_MODEL_ID: 'amazon.nova-premier-v1:0'
  }
});

// バックエンド定義
const backend = defineBackend({
  rekognitionFunction,
  novaLiteFunction,
  novaProFunction,
  novaPremierFunction
});

// DynamoDBテーブルの作成
const counterTable = new dynamodb.Table(
  backend.rekognitionFunction.resources.lambda.stack,
  'ProcessedCounter',
  {
    partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    removalPolicy: RemovalPolicy.DESTROY
  }
);

// Lambda関数にDynamoDB権限を付与
counterTable.grantReadWriteData(backend.rekognitionFunction.resources.lambda);
counterTable.grantReadWriteData(backend.novaLiteFunction.resources.lambda);
counterTable.grantReadWriteData(backend.novaProFunction.resources.lambda);
counterTable.grantReadWriteData(backend.novaPremierFunction.resources.lambda);

// Rekognition権限を付与
backend.rekognitionFunction.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['rekognition:DetectFaces'],
    resources: ['*']
  })
);

// Bedrock権限を付与（Nova Lite）
backend.novaLiteFunction.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['bedrock:InvokeModel'],
    resources: ['arn:aws:bedrock:us-east-1::foundation-model/us.amazon.nova-lite-v1:0']
  })
);

// Bedrock権限を付与（Nova Pro）
backend.novaProFunction.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['bedrock:InvokeModel'],
    resources: ['arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-pro-v1:0']
  })
);

// Bedrock権限を付与（Nova Premier）
backend.novaPremierFunction.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['bedrock:InvokeModel'],
    resources: ['arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-premier-v1:0']
  })
);

// Lambda Function URLを有効化
backend.rekognitionFunction.resources.lambda.addFunctionUrl({
  authType: 'NONE',
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
  }
});

backend.novaLiteFunction.resources.lambda.addFunctionUrl({
  authType: 'NONE',
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
  }
});

backend.novaProFunction.resources.lambda.addFunctionUrl({
  authType: 'NONE',
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
  }
});

backend.novaPremierFunction.resources.lambda.addFunctionUrl({
  authType: 'NONE',
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
  }
});

export default backend;
