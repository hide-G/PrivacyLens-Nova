// Canvas描画とマスク可視化モジュール

let canvas = null;
let ctx = null;
let originalImage = null;
let detectionResults = null;

// 初期化
export function initCanvas() {
  canvas = document.getElementById('resultCanvas');
  ctx = canvas.getContext('2d');
}

// 検出結果を描画
export function renderResults(imageData, results) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      originalImage = img;
      detectionResults = results;
      
      // Canvasサイズを画像に合わせる
      canvas.width = img.width;
      canvas.height = img.height;
      
      // 画像を描画
      ctx.drawImage(img, 0, 0);
      
      // 顔のマスクを描画
      drawFaceMasks(results.faces);
      
      resolve();
    };
    
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    img.src = imageData;
  });
}


// 顔マスクの描画
function drawFaceMasks(faces) {
  if (!faces || faces.length === 0) return;
  
  faces.forEach((face, index) => {
    // 座標を0-999範囲から実際のピクセルに変換
    const x = (face.xmin / 1000) * canvas.width;
    const y = (face.ymin / 1000) * canvas.height;
    const w = ((face.xmax - face.xmin) / 1000) * canvas.width;
    const h = ((face.ymax - face.ymin) / 1000) * canvas.height;
    
    // 半透明黒矩形のマスク
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x, y, w, h);
    
    // 緑色のBounding box枠
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    
    // 顔番号とconfidenceスコアのラベル
    ctx.fillStyle = '#00ff00';
    ctx.font = '14px Arial';
    const label = face.confidence 
      ? `Face ${index + 1} (${face.confidence.toFixed(1)}%)`
      : `Face ${index + 1}`;
    ctx.fillText(label, x + 5, y + 20);
  });
}

// Canvas出力のPNG変換（ダウンロード用）
export function downloadImage() {
  if (!canvas) return;
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `privacylens-nova-masked-${timestamp}.png`;
  
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

// Canvas to Blob変換（X投稿用）
export function getCanvasBlob() {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/png');
  });
}
