// Version: 3.3.0 - Fix Cross-Region IAM with correct model ID format at 2026-03-16 07:29:57
import { defineBackend } from '@aws-amplify/backend';
import { defineFunction } from '@aws-amplify/backend-function';
import { Stack } from 'aws-cdk-lib';
import { Cors, LambdaIntegration, RestApi, AuthorizationType } from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import { RemovalPolicy } from 'aws-cdk-lib';

const rekognitionFunction = defineFunction({
  name: 'rekognition-detect-faces',
  entry: './functions/rekognition-detect-faces/handler.js',
  runtime: 20,
  timeoutSeconds: 30,
  memoryMB: 512,
  environment: { COUNTER_TABLE_NAME: 'ProcessedCounter' }
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
    NOVA_MODEL_ID: 'us.amazon.nova-premier-v1:0'
  }
});

const backend = defineBackend({
  rekognitionFunction,
  novaLiteFunction,
  novaProFunction,
  novaPremierFunction
});

const counterTable = new dynamodb.Table(
  backend.rekognitionFunction.resources.lambda.stack,
  'ProcessedCounter',
  {
    partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    removalPolicy: RemovalPolicy.DESTROY
  }
);

counterTable.grantReadWriteData(backend.rekognitionFunction.resources.lambda);
counterTable.grantReadWriteData(backend.novaLiteFunction.resources.lambda);
counterTable.grantReadWriteData(backend.novaProFunction.resources.lambda);
counterTable.grantReadWriteData(backend.novaPremierFunction.resources.lambda);

backend.rekognitionFunction.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['rekognition:DetectFaces'],
    resources: ['*']
  })
);

backend.novaLiteFunction.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['bedrock:InvokeModel'],
    resources: [
      'arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0',
      'arn:aws:bedrock:us-east-2::foundation-model/amazon.nova-lite-v1:0',
      'arn:aws:bedrock:us-west-2::foundation-model/amazon.nova-lite-v1:0',
      'arn:aws:bedrock:*:285336573977:inference-profile/us.amazon.nova-lite-v1:0'
    ]
  })
);

backend.novaProFunction.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['bedrock:InvokeModel'],
    resources: [
      'arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-pro-v1:0',
      'arn:aws:bedrock:us-east-1:285336573977:inference-profile/us.amazon.nova-pro-v1:0'
    ]
  })
);

backend.novaPremierFunction.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['bedrock:InvokeModel'],
    resources: [
      'arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-premier-v1:0',
      'arn:aws:bedrock:us-east-2::foundation-model/amazon.nova-premier-v1:0',
      'arn:aws:bedrock:us-west-2::foundation-model/amazon.nova-premier-v1:0',
      'arn:aws:bedrock:*:285336573977:inference-profile/us.amazon.nova-premier-v1:0'
    ]
  })
);

// Create API Gateway REST API
const apiStack = backend.createStack('api-stack');

const faceDetectionApi = new RestApi(apiStack, 'FaceDetectionApi', {
  restApiName: 'PrivacyLensFaceDetectionApi',
  deploy: true,
  deployOptions: {
    stageName: 'prod'
  },
  defaultCorsPreflightOptions: {
    allowOrigins: Cors.ALL_ORIGINS,
    allowMethods: ['POST', 'OPTIONS'],
    allowHeaders: ['Content-Type']
  }
});

// Create Lambda integrations
const rekognitionIntegration = new LambdaIntegration(backend.rekognitionFunction.resources.lambda);
const novaLiteIntegration = new LambdaIntegration(backend.novaLiteFunction.resources.lambda);
const novaProIntegration = new LambdaIntegration(backend.novaProFunction.resources.lambda);
const novaPremierIntegration = new LambdaIntegration(backend.novaPremierFunction.resources.lambda);

// Add API routes (no authentication required)
const rekognitionPath = faceDetectionApi.root.addResource('rekognition');
rekognitionPath.addMethod('POST', rekognitionIntegration, {
  authorizationType: AuthorizationType.NONE
});

const novaLitePath = faceDetectionApi.root.addResource('nova-lite');
novaLitePath.addMethod('POST', novaLiteIntegration, {
  authorizationType: AuthorizationType.NONE
});

const novaProPath = faceDetectionApi.root.addResource('nova-pro');
novaProPath.addMethod('POST', novaProIntegration, {
  authorizationType: AuthorizationType.NONE
});

const novaPremierPath = faceDetectionApi.root.addResource('nova-premier');
novaPremierPath.addMethod('POST', novaPremierIntegration, {
  authorizationType: AuthorizationType.NONE
});

// Add API endpoint to outputs
backend.addOutput({
  custom: {
    API: {
      [faceDetectionApi.restApiName]: {
        endpoint: faceDetectionApi.url,
        region: Stack.of(faceDetectionApi).region,
        apiName: faceDetectionApi.restApiName
      }
    }
  }
});

export default backend;