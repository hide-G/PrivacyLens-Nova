// DynamoDBテーブル定義
import { defineData, a } from '@aws-amplify/backend';

const schema = a.schema({
  ProcessedCounter: a.customType({
    pk: a.string().required(),
    processed_count: a.integer().required()
  })
});

export type Schema = typeof schema;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'iam'
  }
});
