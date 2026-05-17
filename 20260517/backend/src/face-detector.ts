/**
 * PrivacyLens Nova - 顔検出モジュール
 *
 * Amazon Bedrock Nova 2 Lite を使用して画像内の顔を検出し、
 * バウンディングボックス座標を返す。
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import type { BoundingBox } from './types.js';

/** Bedrock モデルID */
const MODEL_ID = 'amazon.nova-lite-v1:0';

/** リージョン */
const REGION = 'us-east-1';

/** 最大検出顔数 */
const MAX_FACES = 20;

/** Bedrock ランタイムクライアント */
const bedrockClient = new BedrockRuntimeClient({ region: REGION });

/**
 * 顔検出用プロンプトを生成する
 * Nova 2 Lite の物体検出機能を使用して顔のバウンディングボックスを取得する
 */
function buildDetectionPrompt(): string {
  return 'Detect all human faces in this image. For each face detected, provide the bounding box coordinates in the format [x1, y1, x2, y2] where coordinates are on a scale of 0 to 1000. x1,y1 is the top-left corner and x2,y2 is the bottom-right corner. Return only the bounding boxes as a JSON array of arrays, like [[x1,y1,x2,y2],[x1,y1,x2,y2]]. If no faces are found, return an empty array [].';
}

/**
 * バウンディングボックス座標をバリデーションする
 * - 各値が0以上1000以下の整数であること
 * - x1 < x2 かつ y1 < y2 であること
 */
function validateBoundingBox(box: number[]): BoundingBox | null {
  if (box.length !== 4) {
    return null;
  }

  const [x1, y1, x2, y2] = box;

  // 各値が数値であることを確認
  if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) {
    return null;
  }

  // 整数に丸める
  const roundedX1 = Math.round(x1);
  const roundedY1 = Math.round(y1);
  const roundedX2 = Math.round(x2);
  const roundedY2 = Math.round(y2);

  // 範囲チェック: 0 <= 値 <= 1000
  if (roundedX1 < 0 || roundedX1 > 1000) return null;
  if (roundedY1 < 0 || roundedY1 > 1000) return null;
  if (roundedX2 < 0 || roundedX2 > 1000) return null;
  if (roundedY2 < 0 || roundedY2 > 1000) return null;

  // 順序チェック: x1 < x2 かつ y1 < y2
  if (roundedX1 >= roundedX2) return null;
  if (roundedY1 >= roundedY2) return null;

  return {
    x1: roundedX1,
    y1: roundedY1,
    x2: roundedX2,
    y2: roundedY2,
  };
}

/**
 * Nova 2 Lite のレスポンステキストからバウンディングボックス座標をパースする
 *
 * レスポンスには以下のような形式が含まれる可能性がある:
 * - JSON配列: [[120, 80, 350, 420], [600, 100, 820, 450]]
 * - テキスト内に埋め込まれた座標: [120, 80, 350, 420]
 *
 * @param responseText - Nova 2 Lite からのレスポンステキスト
 * @returns バリデーション済みのバウンディングボックス配列（最大20個）
 */
export function parseBoundingBoxes(responseText: string): BoundingBox[] {
  if (!responseText || typeof responseText !== 'string') {
    return [];
  }

  const boxes: BoundingBox[] = [];

  // まず、JSON配列全体としてパースを試みる
  try {
    // レスポンステキストからJSON配列部分を抽出
    const jsonMatch = responseText.match(/\[\s*\[[\s\S]*?\]\s*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (Array.isArray(item)) {
            const validated = validateBoundingBox(item as number[]);
            if (validated) {
              boxes.push(validated);
              if (boxes.length >= MAX_FACES) break;
            }
          }
        }
        if (boxes.length > 0) {
          return boxes;
        }
      }
    }
  } catch {
    // JSON全体パースに失敗した場合、個別パースにフォールバック
  }

  // 個別の [x1, y1, x2, y2] パターンを抽出
  const boxPattern = /\[\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\]/g;
  let match: RegExpExecArray | null;

  while ((match = boxPattern.exec(responseText)) !== null) {
    const values = [
      parseFloat(match[1]),
      parseFloat(match[2]),
      parseFloat(match[3]),
      parseFloat(match[4]),
    ];

    const validated = validateBoundingBox(values);
    if (validated) {
      boxes.push(validated);
      if (boxes.length >= MAX_FACES) break;
    }
  }

  return boxes;
}

/**
 * Base64エンコードされた画像データからフォーマットを検出する
 * マジックバイトを確認して判定する
 */
function detectImageFormat(base64Image: string): string {
  // 最初の数バイトをデコードしてマジックバイトを確認
  const header = base64Image.substring(0, 16);
  
  // PNG: iVBORw0KGgo (Base64 of 0x89504E47)
  if (header.startsWith('iVBORw')) {
    return 'png';
  }
  // JPEG: /9j/ (Base64 of 0xFFD8FF)
  if (header.startsWith('/9j/')) {
    return 'jpeg';
  }
  // GIF: R0lGOD (Base64 of GIF89a or GIF87a)
  if (header.startsWith('R0lGOD')) {
    return 'gif';
  }
  // WebP: UklGR (Base64 of RIFF)
  if (header.startsWith('UklGR')) {
    return 'webp';
  }
  // デフォルトはjpeg
  return 'jpeg';
}

/** 顔検出結果（トークン情報含む） */
export interface DetectFacesResult {
  faces: BoundingBox[];
  inputTokens: number;
  outputTokens: number;
}

/**
 * Base64エンコードされた画像から顔を検出する
 *
 * Amazon Bedrock Nova 2 Lite モデルを呼び出し、
 * 画像内の顔のバウンディングボックス座標を返す。
 *
 * @param base64Image - Base64エンコードされた画像データ（data URI prefix なし）
 * @returns 検出された顔のバウンディングボックス配列とトークン情報
 * @throws Bedrock API呼び出しに失敗した場合
 */
export async function detectFaces(base64Image: string): Promise<DetectFacesResult> {
  const prompt = buildDetectionPrompt();

  // Base64データから画像フォーマットを検出する
  const format = detectImageFormat(base64Image);

  // Nova 2 Lite のリクエストボディを構築
  const requestBody = {
    messages: [
      {
        role: 'user',
        content: [
          {
            image: {
              format,
              source: {
                bytes: base64Image,
              },
            },
          },
          {
            text: prompt,
          },
        ],
      },
    ],
    inferenceConfig: {
      max_new_tokens: 2048,
      temperature: 0.1,
      top_p: 0.9,
    },
  };

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(requestBody),
  });

  const response = await bedrockClient.send(command);

  // レスポンスボディをデコード
  const responseBody = JSON.parse(
    new TextDecoder().decode(response.body)
  ) as {
    output?: { message?: { content?: Array<{ text?: string }> } };
    usage?: { inputTokens?: number; outputTokens?: number };
  };

  // レスポンステキストを抽出
  const responseText =
    responseBody?.output?.message?.content?.[0]?.text ?? '';

  // トークン情報を取得
  const inputTokens = responseBody?.usage?.inputTokens ?? 0;
  const outputTokens = responseBody?.usage?.outputTokens ?? 0;

  // バウンディングボックスをパースして返す
  return {
    faces: parseBoundingBoxes(responseText),
    inputTokens,
    outputTokens,
  };
}
