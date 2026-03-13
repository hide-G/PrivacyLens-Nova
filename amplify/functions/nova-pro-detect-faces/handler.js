// Nova Pro v1顔検出Lambda関数
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const bedrock = new BedrockRuntimeClient({ region: "us-east-1" });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const COUNTER_TABLE_NAME = process.env.COUNTER_TABLE_NAME || 'ProcessedCounter';
const MODEL_ID = process.env.NOVA_MODEL_ID || 'amazon.nova-pro-v1:0';

// Nova Pro料金（1Kトークンあたり）
const PRICING = {
  input: 0.0008,
  output: 0.0032
};

export const handler = async (event) => {
  console.log('Nova Pro Lambda起動');
  
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
    
    // 画像フォーマット検出
    const format = detectImageFormat(imageBuffer);
    console.log(`画像フォーマット: ${format}, サイズ: ${imageBuffer.length} bytes`);
    
    // プロンプト
    const prompt = `Detect all human faces in this image and return their bounding boxes.
Output format: JSON array with objects containing xmin, ymin, xmax, ymax coordinates.
Coordinate system: 0-1000 range where (0,0) is top-left and (1000,1000) is bottom-right.
Example: [{"xmin":100,"ymin":200,"xmax":300,"ymax":400}]`;
    
    // Bedrock Converse API呼び出し
    const command = new ConverseCommand({
      modelId: MODEL_ID,
      messages: [
        {
          role: "user",
          content: [
            {
              image: {
                format: format,
                source: { bytes: imageBuffer }
              }
            },
            {
              text: prompt
            }
          ]
        }
      ],
      inferenceConfig: {
        temperature: 0.0,
        maxTokens: 2048
      }
    });
    
    const response = await bedrock.send(command);
    const responseText = response.output.message.content[0].text;
    console.log('Nova応答:', responseText);
    
    // トークン数取得
    const inputTokens = response.usage.inputTokens;
    const outputTokens = response.usage.outputTokens;
    
    // コスト計算
    const inputCost = (inputTokens / 1000) * PRICING.input;
    const outputCost = (outputTokens / 1000) * PRICING.output;
    const estimatedCost = inputCost + outputCost;
    
    console.log(`トークン数 - 入力: ${inputTokens}, 出力: ${outputTokens}, コスト: $${estimatedCost.toFixed(6)}`);
    
    // JSON解析
    const faces = parseNovaResponse(responseText);
    console.log(`検出された顔の数: ${faces.length}`);
    
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
    }
    
    // レスポンス返却
    return successResponse({
      service: 'Amazon Nova Pro v1',
      faces: faces,
      faceCount: faces.length,
      rawResponse: responseText,
      cost: {
        inputTokens: inputTokens,
        outputTokens: outputTokens,
        estimatedCost: estimatedCost,
        currency: 'USD'
      },
      processedCount: processedCount
    });
    
  } catch (error) {
    console.error('エラー:', error);
    return errorResponse(500, `内部エラー: ${error.message}`);
  }
};

function detectImageFormat(buffer) {
  const header = buffer.slice(0, 12);
  
  // PNG: 89 50 4E 47
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
    return "png";
  }
  
  // JPEG: FF D8 FF
  if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
    return "jpeg";
  }
  
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
      header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50) {
    return "webp";
  }
  
  throw new Error('サポートされていない画像フォーマットです');
}

function parseNovaResponse(responseText) {
  // JSON配列を抽出
  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.warn('Nova応答にJSON配列が見つかりません');
    return [];
  }
  
  const faces = JSON.parse(jsonMatch[0]);
  
  // バリデーションとフィルタリング
  return faces.filter(face => {
    const isValid = 
      face.xmin >= 0 && face.xmin <= 1000 &&
      face.ymin >= 0 && face.ymin <= 1000 &&
      face.xmax >= 0 && face.xmax <= 1000 &&
      face.ymax >= 0 && face.ymax <= 1000 &&
      face.xmax > face.xmin &&
      face.ymax > face.ymin &&
      (face.xmax - face.xmin) >= 10 &&
      (face.ymax - face.ymin) >= 10;
    
    if (!isValid) {
      console.warn('無効な顔をスキップ:', face);
    }
    return isValid;
  });
}

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
