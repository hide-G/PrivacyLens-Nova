// Rekognition顔検出Lambda関数
import { RekognitionClient, DetectFacesCommand } from "@aws-sdk/client-rekognition";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const rekognition = new RekognitionClient({ region: process.env.AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const COUNTER_TABLE_NAME = process.env.COUNTER_TABLE_NAME || 'ProcessedCounter';

export const handler = async (event) => {
  console.log('Rekognition Lambda起動');
  
  try {
    // リクエストボディの解析
    const body = JSON.parse(event.body);
    const base64Image = body.image;
    
    if (!base64Image) {
      return errorResponse(400, '画像データが提供されていません');
    }
    
    // Base64デコード
    const imageBuffer = Buffer.from(base64Image, 'base64');
    
    // 画像サイズバリデーション（5MB制限）
    if (imageBuffer.length > 5 * 1024 * 1024) {
      return errorResponse(400, '画像サイズが5MBを超えています');
    }
    
    console.log(`画像サイズ: ${imageBuffer.length} bytes`);
    
    // Rekognition DetectFaces API呼び出し
    const command = new DetectFacesCommand({
      Image: { Bytes: imageBuffer },
      Attributes: ['DEFAULT']
    });
    
    const response = await rekognition.send(command);
    console.log(`検出された顔の数: ${response.FaceDetails.length}`);
    
    // 座標正規化（0-999範囲）
    const faces = response.FaceDetails.map(face => {
      const box = face.BoundingBox;
      return {
        xmin: Math.floor(box.Left * 1000),
        ymin: Math.floor(box.Top * 1000),
        xmax: Math.floor((box.Left + box.Width) * 1000),
        ymax: Math.floor((box.Top + box.Height) * 1000),
        confidence: Math.round(face.Confidence * 10) / 10
      };
    });
    
    // DynamoDBカウンターのインクリメント
    let processedCount = 0;
    try {
      const updateResult = await docClient.send(new UpdateCommand({
        TableName: COUNTER_TABLE_NAME,
        Key: { pk: 'global' },
        UpdateExpression: 'ADD processed_count :inc',
        ExpressionAttributeValues: { ':inc': 1 },
        ReturnValues: 'UPDATED'
      }));
      processedCount = updateResult.Attributes?.processed_count || 0;
      console.log(`処理枚数カウンター更新: ${processedCount}`);
    } catch (dbError) {
      console.warn('DynamoDBカウンター更新エラー:', dbError);
      // カウンター更新失敗は致命的エラーではないので続行
    }
    
    // レスポンス返却
    return successResponse({
      service: 'Rekognition DetectFaces',
      faces: faces,
      faceCount: faces.length,
      cost: {
        estimatedCost: 0.001,
        currency: 'USD'
      },
      processedCount: processedCount
    });
    
  } catch (error) {
    console.error('エラー:', error);
    return errorResponse(500, `内部エラー: ${error.message}`);
  }
};

function successResponse(data) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: JSON.stringify(data)
  };
}

function errorResponse(statusCode, message) {
  return {
    statusCode: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: JSON.stringify({ error: message })
  };
}
