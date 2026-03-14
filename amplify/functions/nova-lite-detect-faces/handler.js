// Nova Lite v2 Face Detection Lambda Function
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const bedrock = new BedrockRuntimeClient({ region: "us-east-1" });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const COUNTER_TABLE_NAME = process.env.COUNTER_TABLE_NAME || 'ProcessedCounter';
const MODEL_ID = process.env.NOVA_MODEL_ID || 'us.amazon.nova-lite-v1:0';

// Nova Lite pricing (per 1K tokens)
const PRICING = {
  input: 0.00006,
  output: 0.00024
};

export const handler = async (event) => {
  console.log('Nova Lite Lambda started');
  
  try {
    // Parse request body
    const body = JSON.parse(event.body);
    const base64Image = body.image;
    
    if (!base64Image) {
      return errorResponse(400, 'Image data not provided');
    }
    
    // Base64 decode
    const imageBuffer = Buffer.from(base64Image, 'base64');
    
    // Image size validation (5MB limit)
    if (imageBuffer.length > 5 * 1024 * 1024) {
      return errorResponse(400, 'Image size exceeds 5MB');
    }
    
    // Detect image format
    const format = detectImageFormat(imageBuffer);
    console.log(`Image format: ${format}, size: ${imageBuffer.length} bytes`);
    
    // Prompt
    const prompt = `Detect all human faces in this image and return their bounding boxes.
Output format: JSON array with objects containing xmin, ymin, xmax, ymax coordinates.
Coordinate system: 0-1000 range where (0,0) is top-left and (1000,1000) is bottom-right.
Example: [{"xmin":100,"ymin":200,"xmax":300,"ymax":400}]`;
    
    // Call Bedrock Converse API
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
    console.log('Nova response:', responseText);
    
    // Get token counts
    const inputTokens = response.usage.inputTokens;
    const outputTokens = response.usage.outputTokens;
    
    // Calculate cost
    const inputCost = (inputTokens / 1000) * PRICING.input;
    const outputCost = (outputTokens / 1000) * PRICING.output;
    const estimatedCost = inputCost + outputCost;
    
    console.log(`Tokens - input: ${inputTokens}, output: ${outputTokens}, cost: $${estimatedCost.toFixed(6)}`);
    
    // Parse JSON response
    const faces = parseNovaResponse(responseText);
    console.log(`Detected faces: ${faces.length}`);
    
    // Increment DynamoDB counter
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
      console.log(`Processed count updated: ${processedCount}`);
    } catch (dbError) {
      console.warn('DynamoDB counter update error:', dbError);
    }
    
    // Return response
    return successResponse({
      service: 'Amazon Nova Lite v2',
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
    console.error('Error:', error);
    return errorResponse(500, `Internal error: ${error.message}`);
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
  
  throw new Error('Unsupported image format');
}

function parseNovaResponse(responseText) {
  // Extract JSON array
  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.warn('No JSON array found in Nova response');
    return [];
  }
  
  const faces = JSON.parse(jsonMatch[0]);
  
  // Validation and filtering
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
      console.warn('Skipping invalid face:', face);
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
